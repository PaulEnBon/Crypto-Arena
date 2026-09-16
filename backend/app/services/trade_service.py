"""Virtual trade engine. The server is the only source of truth for prices and balances.

Flow of a trade (buy or sell):
1. the user is authenticated (router dependency);
2. the quantity is validated (> 0, at most 8 decimals, bounded);
3. the asset is resolved (created on first use after CoinGecko confirms it exists);
4. the current EUR price is fetched from CoinGecko (per-coin cached quote);
5. the total is computed and rounded to the cent;
6. the portfolio row (and holding row) are locked with SELECT ... FOR UPDATE;
7. balances/holdings are checked and updated, the transaction is written;
8. everything is committed atomically and the fresh portfolio summary is returned.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    InsufficientFundsError,
    InsufficientHoldingsError,
    InvalidPriceError,
    InvalidQuantityError,
)
from app.models import Holding, Transaction, TransactionType, User
from app.schemas.trade import TradeResponse
from app.services.asset_service import get_or_create_asset
from app.services.coingecko_service import CoinGeckoService
from app.services.leaderboard_service import invalidate_ranking_cache
from app.services.portfolio_service import (
    build_portfolio_summary,
    get_portfolio,
    record_snapshot,
    to_transaction_out,
)

CENT = Decimal("0.01")
PRICE_PRECISION = Decimal("0.00000001")
QUANTITY_MAX_DECIMALS = 8
QUANTITY_MAX = Decimal("1000000000")
MIN_TOTAL = Decimal("0.01")


# ---------------------------------------------------------------- pure helpers (unit-tested)


def validate_quantity(quantity: Decimal) -> Decimal:
    if not quantity.is_finite() or quantity <= 0:
        raise InvalidQuantityError("La quantité doit être supérieure à 0.")
    if quantity > QUANTITY_MAX:
        raise InvalidQuantityError("La quantité est trop élevée.")
    exponent = quantity.normalize().as_tuple().exponent
    if isinstance(exponent, int) and -exponent > QUANTITY_MAX_DECIMALS:
        raise InvalidQuantityError(f"La quantité ne peut pas dépasser {QUANTITY_MAX_DECIMALS} décimales.")
    return quantity


def compute_total(quantity: Decimal, price: Decimal) -> Decimal:
    """Cash moved by the trade, rounded to the cent (half-up) like a real broker statement."""
    return (quantity * price).quantize(CENT, rounding=ROUND_HALF_UP)


def apply_buy(current_qty: Decimal, current_avg: Decimal, qty: Decimal, price: Decimal) -> tuple[Decimal, Decimal]:
    """Average-cost method: the new average price weights the previous position and the purchase."""
    new_qty = current_qty + qty
    new_avg = ((current_qty * current_avg) + (qty * price)) / new_qty
    return new_qty, new_avg.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)


def extract_price(quote: dict[str, Any] | None) -> Decimal:
    raw = quote.get("eur") if quote else None
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or raw <= 0:
        raise InvalidPriceError("Prix indisponible pour cette cryptomonnaie, réessayez plus tard.")
    return Decimal(str(raw)).quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- engine


async def execute_trade(
    db: AsyncSession,
    user: User,
    coin_id: str,
    quantity: Decimal,
    side: TransactionType,
    coingecko: CoinGeckoService,
) -> TradeResponse:
    quantity = validate_quantity(quantity)
    asset = await get_or_create_asset(db, coin_id, coingecko)

    quotes = await coingecko.get_simple_prices([asset.coingecko_id])
    price = extract_price(quotes.get(asset.coingecko_id))
    total = compute_total(quantity, price)
    if total < MIN_TOTAL:
        raise InvalidQuantityError("Le montant de la transaction doit être d'au moins 0,01 €.")

    # Lock order is always portfolio -> holding to avoid deadlocks between concurrent trades.
    portfolio = await get_portfolio(db, user.id, for_update=True)
    # `of=Holding`: lock only the holding row, not the asset joined for display (PostgreSQL forbids
    # FOR UPDATE on the nullable side of an outer join).
    holding = await db.scalar(
        select(Holding)
        .where(Holding.portfolio_id == portfolio.id, Holding.asset_id == asset.id)
        .with_for_update(of=Holding)
        .execution_options(populate_existing=True)
    )

    if side is TransactionType.BUY:
        if portfolio.cash_balance < total:
            raise InsufficientFundsError(
                f"Fonds insuffisants : {total:.2f} € requis, {portfolio.cash_balance:.2f} € disponibles."
            )
        portfolio.cash_balance -= total
        if holding is None:
            holding = Holding(portfolio_id=portfolio.id, asset_id=asset.id, quantity=Decimal("0"), avg_buy_price=Decimal("0"))
            db.add(holding)
        holding.quantity, holding.avg_buy_price = apply_buy(holding.quantity, holding.avg_buy_price, quantity, price)
        message = f"Achat de {quantity.normalize():f} {asset.symbol} pour {total:.2f} € effectué."
    else:
        held = holding.quantity if holding is not None else Decimal("0")
        if holding is None or held < quantity:
            raise InsufficientHoldingsError(
                f"Quantité insuffisante : vous détenez {held.normalize():f} {asset.symbol}."
            )
        holding.quantity = held - quantity
        portfolio.cash_balance += total
        message = f"Vente de {quantity.normalize():f} {asset.symbol} pour {total:.2f} € effectuée."

    transaction = Transaction(
        user_id=user.id, asset_id=asset.id, type=side.value, quantity=quantity, price=price, total=total
    )
    db.add(transaction)
    await db.commit()

    summary = await build_portfolio_summary(db, user, coingecko)
    await record_snapshot(db, user.id, summary, force=True)
    invalidate_ranking_cache()

    return TradeResponse(message=message, transaction=to_transaction_out(transaction, asset), portfolio=summary)
