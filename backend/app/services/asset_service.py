"""Asset catalogue: curated list seeded at start-up, plus lazy creation of any CoinGecko coin on first trade."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import CoinGeckoError
from app.models import Asset
from app.services.coingecko_service import CoinGeckoService

logger = logging.getLogger(__name__)

# CoinGecko ids of the coins pre-registered in the `assets` table (images are fetched from CoinGecko).
CURATED_ASSETS: list[tuple[str, str, str]] = [
    ("bitcoin", "BTC", "Bitcoin"),
    ("ethereum", "ETH", "Ethereum"),
    ("tether", "USDT", "Tether"),
    ("binancecoin", "BNB", "BNB"),
    ("solana", "SOL", "Solana"),
    ("ripple", "XRP", "XRP"),
    ("dogecoin", "DOGE", "Dogecoin"),
    ("cardano", "ADA", "Cardano"),
    ("tron", "TRX", "TRON"),
    ("avalanche-2", "AVAX", "Avalanche"),
    ("chainlink", "LINK", "Chainlink"),
    ("polkadot", "DOT", "Polkadot"),
    ("litecoin", "LTC", "Litecoin"),
    ("shiba-inu", "SHIB", "Shiba Inu"),
    ("uniswap", "UNI", "Uniswap"),
    ("stellar", "XLM", "Stellar"),
    ("polygon-ecosystem-token", "POL", "POL (ex-MATIC)"),
    ("near", "NEAR", "NEAR Protocol"),
    ("monero", "XMR", "Monero"),
    ("bitcoin-cash", "BCH", "Bitcoin Cash"),
]


async def seed_curated_assets(db: AsyncSession) -> int:
    """Insert the curated assets that are missing. Returns the number of rows created."""
    existing = set((await db.scalars(select(Asset.coingecko_id))).all())
    created = 0
    for coingecko_id, symbol, name in CURATED_ASSETS:
        if coingecko_id not in existing:
            db.add(Asset(coingecko_id=coingecko_id, symbol=symbol, name=name))
            created += 1
    await db.commit()
    return created


async def refresh_asset_metadata(db: AsyncSession, coingecko: CoinGeckoService) -> int:
    """Best-effort update of symbol/name/image from CoinGecko for every known asset (one markets call)."""
    assets = (await db.scalars(select(Asset))).all()
    if not assets:
        return 0
    try:
        markets = await coingecko.get_markets(page=1, per_page=250, ids=[asset.coingecko_id for asset in assets])
    except CoinGeckoError as exc:
        logger.warning("Asset metadata refresh skipped: %s", exc.detail)
        return 0
    by_id = {item["id"]: item for item in markets if isinstance(item, dict) and "id" in item}
    updated = 0
    for asset in assets:
        item = by_id.get(asset.coingecko_id)
        if item is None:
            continue
        asset.symbol = str(item.get("symbol") or asset.symbol).upper()[:20]
        asset.name = str(item.get("name") or asset.name)[:100]
        asset.image_url = item.get("image") or asset.image_url
        updated += 1
    await db.commit()
    return updated


async def get_asset_by_coin_id(db: AsyncSession, coin_id: str) -> Asset | None:
    return await db.scalar(select(Asset).where(Asset.coingecko_id == coin_id))


async def get_or_create_asset(db: AsyncSession, coin_id: str, coingecko: CoinGeckoService) -> Asset:
    """Resolve an asset row for a CoinGecko id, registering it after validating the coin exists upstream."""
    asset = await get_asset_by_coin_id(db, coin_id)
    if asset is not None:
        return asset

    data = await coingecko.get_coin(coin_id)  # raises CoinNotFoundError when the id is unknown
    image = data.get("image") or {}
    candidate = Asset(
        coingecko_id=coin_id,
        symbol=str(data.get("symbol") or coin_id).upper()[:20],
        name=str(data.get("name") or coin_id)[:100],
        image_url=image.get("small") or image.get("large") if isinstance(image, dict) else None,
    )
    try:
        async with db.begin_nested():  # SAVEPOINT: a concurrent insert must not abort the caller's transaction
            db.add(candidate)
            await db.flush()
    except IntegrityError:
        existing = await get_asset_by_coin_id(db, coin_id)
        if existing is None:
            raise
        return existing
    return candidate
