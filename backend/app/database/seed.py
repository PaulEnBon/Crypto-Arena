"""Demo / development seed. Clearly separated from production data:

- refuses to run when APP_ENV=production (unless --force);
- every generated account is flagged `users.is_demo = true` and uses an @cryptoarena.dev email;
- `--reset` deletes only the flagged demo accounts (cascade) before recreating them.

    python -m app.database.seed            # create the demo accounts that are missing
    python -m app.database.seed --reset    # wipe demo accounts, then recreate them

Demo login: demo@cryptoarena.dev / Demo123!
"""

import argparse
import logging
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_DOWN, Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import hash_password
from app.config import get_settings
from app.database.init_db import create_tables
from app.database.session import AsyncSessionLocal, engine
from app.exceptions import CoinGeckoError
from app.models import Asset, Holding, Portfolio, PortfolioSnapshot, Transaction, User
from app.runtime import run
from app.services.asset_service import refresh_asset_metadata, seed_curated_assets
from app.services.coingecko_service import CoinGeckoService
from app.services.trade_service import apply_buy, compute_total

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Demo123!"
DEMO_DOMAIN = "cryptoarena.dev"
SNAPSHOT_DAYS = 30
QUANTITY_PRECISION = Decimal("0.00000001")

# Approximate EUR prices used only when CoinGecko is unreachable during seeding.
FALLBACK_PRICES_EUR: dict[str, Decimal] = {
    "bitcoin": Decimal("95000"),
    "ethereum": Decimal("3200"),
    "solana": Decimal("150"),
    "ripple": Decimal("2.2"),
    "dogecoin": Decimal("0.18"),
    "cardano": Decimal("0.6"),
    "chainlink": Decimal("15"),
    "avalanche-2": Decimal("25"),
    "polkadot": Decimal("5"),
    "litecoin": Decimal("90"),
    "near": Decimal("3"),
    "uniswap": Decimal("8"),
    "stellar": Decimal("0.3"),
    "shiba-inu": Decimal("0.00001"),
    "tron": Decimal("0.25"),
    "binancecoin": Decimal("600"),
}


@dataclass(frozen=True)
class SeedTrade:
    coin_id: str
    side: str  # "BUY" -> amount is euros spent ; "SELL" -> amount is the fraction of the position sold
    amount: Decimal
    days_ago: int
    price_factor: Decimal  # price at trade time relative to today's price (0.9 = bought 10 % cheaper)


@dataclass(frozen=True)
class SeedUser:
    username: str
    trades: tuple[SeedTrade, ...]

    @property
    def email(self) -> str:
        return f"{self.username.lower()}@{DEMO_DOMAIN}"


def buy(coin_id: str, euros: str, days_ago: int, factor: str) -> SeedTrade:
    return SeedTrade(coin_id, "BUY", Decimal(euros), days_ago, Decimal(factor))


def sell(coin_id: str, fraction: str, days_ago: int, factor: str) -> SeedTrade:
    return SeedTrade(coin_id, "SELL", Decimal(fraction), days_ago, Decimal(factor))


DEMO_USERS: tuple[SeedUser, ...] = (
    SeedUser(
        "demo",
        (
            buy("bitcoin", "2500", 20, "0.93"),
            buy("ethereum", "1500", 15, "0.90"),
            buy("solana", "800", 10, "1.05"),
            buy("dogecoin", "300", 7, "0.95"),
            sell("solana", "0.5", 3, "1.02"),
            buy("cardano", "400", 2, "1.00"),
        ),
    ),
    SeedUser("CryptoMaster", (buy("bitcoin", "4000", 28, "0.78"), buy("ethereum", "3000", 25, "0.80"), buy("solana", "2000", 20, "0.85"))),
    SeedUser("TraderX", (buy("ethereum", "5000", 27, "0.82"), buy("chainlink", "2000", 18, "0.88"), sell("ethereum", "0.3", 5, "1.03"))),
    SeedUser("MoonBoy", (buy("dogecoin", "3000", 26, "0.85"), buy("shiba-inu", "2000", 22, "0.90"), buy("solana", "2500", 14, "0.90"))),
    SeedUser("SatoshiFan", (buy("bitcoin", "9000", 29, "0.90"),)),
    SeedUser("HodlQueen", (buy("bitcoin", "3000", 28, "0.95"), buy("ethereum", "3000", 28, "0.95"), buy("cardano", "1000", 28, "1.10"))),
    SeedUser("AltcoinAndy", (buy("avalanche-2", "2000", 21, "1.15"), buy("polkadot", "2000", 21, "1.20"), buy("near", "1500", 12, "1.10"), buy("uniswap", "1000", 9, "1.05"))),
    SeedUser("DiamondHands", (buy("ripple", "4000", 24, "0.88"), buy("stellar", "1500", 24, "0.95"))),
    SeedUser("PaperHands", (buy("bitcoin", "5000", 20, "1.08"), sell("bitcoin", "1", 10, "0.97"), buy("ethereum", "1000", 4, "1.02"))),
    SeedUser("WhaleWatcher", (buy("binancecoin", "2500", 19, "0.97"), buy("tron", "1500", 19, "0.92"), buy("litecoin", "1500", 8, "1.00"))),
)


async def load_current_prices(coingecko: CoinGeckoService, coin_ids: list[str]) -> dict[str, Decimal]:
    prices = dict(FALLBACK_PRICES_EUR)
    try:
        quotes = await coingecko.get_simple_prices(coin_ids)
    except CoinGeckoError as exc:
        logger.warning("CoinGecko unavailable (%s): using fallback prices", exc.detail)
        return prices
    for coin_id, quote in quotes.items():
        value = quote.get("eur")
        if isinstance(value, (int, float)) and value > 0:
            prices[coin_id] = Decimal(str(value))
    return prices


@dataclass
class Position:
    quantity: Decimal = Decimal("0")
    avg_buy_price: Decimal = Decimal("0")


def build_user_rows(
    seed_user: SeedUser,
    assets: dict[str, Asset],
    prices: dict[str, Decimal],
    password_hash: str,
    initial_balance: Decimal,
) -> User:
    now = datetime.now(timezone.utc)
    rng = random.Random(seed_user.username)
    user = User(username=seed_user.username, email=seed_user.email, password_hash=password_hash, is_demo=True)
    user.created_at = now - timedelta(days=SNAPSHOT_DAYS + rng.randint(1, 20))
    portfolio = Portfolio(cash_balance=initial_balance, initial_balance=initial_balance)
    user.portfolio = portfolio
    positions: dict[str, Position] = {}

    for trade in sorted(seed_user.trades, key=lambda t: -t.days_ago):
        asset = assets[trade.coin_id]
        price = (prices[trade.coin_id] * trade.price_factor).quantize(Decimal("0.00000001"))
        position = positions.setdefault(trade.coin_id, Position())
        if trade.side == "BUY":
            quantity = (trade.amount / price).quantize(QUANTITY_PRECISION, rounding=ROUND_DOWN)
            total = compute_total(quantity, price)
            portfolio.cash_balance -= total
            position.quantity, position.avg_buy_price = apply_buy(
                position.quantity, position.avg_buy_price, quantity, price
            )
        else:
            quantity = (position.quantity * trade.amount).quantize(QUANTITY_PRECISION, rounding=ROUND_DOWN)
            total = compute_total(quantity, price)
            position.quantity -= quantity
            portfolio.cash_balance += total
        user.transactions.append(
            Transaction(
                asset=asset,
                type=trade.side,
                quantity=quantity,
                price=price,
                total=total,
                created_at=now - timedelta(days=trade.days_ago, hours=rng.randint(1, 12)),
            )
        )

    holdings_value = Decimal("0")
    for coin_id, position in positions.items():
        if position.quantity > 0:
            portfolio.holdings.append(
                Holding(asset=assets[coin_id], quantity=position.quantity, avg_buy_price=position.avg_buy_price)
            )
            holdings_value += position.quantity * prices[coin_id]

    final_value = portfolio.cash_balance + holdings_value
    for day in range(SNAPSHOT_DAYS, -1, -1):
        progress = Decimal(SNAPSHOT_DAYS - day) / Decimal(SNAPSHOT_DAYS)
        noise = Decimal(str(rng.uniform(-0.012, 0.012))) * initial_balance if day > 0 else Decimal("0")
        value = (initial_balance + (final_value - initial_balance) * progress + noise).quantize(Decimal("0.01"))
        user.snapshots.append(
            PortfolioSnapshot(
                total_value=value,
                profit_loss=value - initial_balance,
                created_at=now - timedelta(days=day, minutes=rng.randint(0, 59)),
            )
        )
    return user


async def seed_demo_data(db: AsyncSession, coingecko: CoinGeckoService, *, reset: bool = False) -> int:
    settings = get_settings()
    await create_tables()
    await seed_curated_assets(db)
    await refresh_asset_metadata(db, coingecko)

    if reset:
        result = await db.execute(delete(User).where(User.is_demo.is_(True)))
        await db.commit()
        logger.info("Removed %s demo account(s)", result.rowcount)

    existing_emails = set((await db.scalars(select(User.email))).all())
    coin_ids = sorted({trade.coin_id for seed_user in DEMO_USERS for trade in seed_user.trades})
    assets = {asset.coingecko_id: asset for asset in (await db.scalars(select(Asset))).all()}
    missing = [coin_id for coin_id in coin_ids if coin_id not in assets]
    if missing:
        raise RuntimeError(f"Assets manquants dans le catalogue : {missing}")

    prices = await load_current_prices(coingecko, coin_ids)
    password_hash = hash_password(DEMO_PASSWORD)

    created = 0
    for seed_user in DEMO_USERS:
        if seed_user.email in existing_emails:
            logger.info("Skipping %s (already exists)", seed_user.email)
            continue
        db.add(build_user_rows(seed_user, assets, prices, password_hash, settings.INITIAL_BALANCE))
        created += 1
    await db.commit()
    logger.info("Seed complete: %d demo account(s) created (password: %s)", created, DEMO_PASSWORD)
    return created


async def main(reset: bool, force: bool) -> None:
    settings = get_settings()
    if settings.is_production and not force:
        raise SystemExit("Refus : APP_ENV=production. Relancez avec --force si vous savez ce que vous faites.")
    coingecko = CoinGeckoService(settings)
    try:
        async with AsyncSessionLocal() as db:
            await seed_demo_data(db, coingecko, reset=reset)
    finally:
        await coingecko.aclose()
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Crypto Arena demo data")
    parser.add_argument("--reset", action="store_true", help="delete demo accounts before recreating them")
    parser.add_argument("--force", action="store_true", help="allow running with APP_ENV=production")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run(main(reset=args.reset, force=args.force))
