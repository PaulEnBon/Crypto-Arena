"""Database initialisation: create the schema and seed the curated asset catalogue.

    python -m app.database.init_db

Also executed automatically at start-up when AUTO_INIT_DB=true (create_all is idempotent).
"""

import logging

import app.models  # noqa: F401 - importing registers every table on Base.metadata
from app.config import get_settings
from app.database.base import Base
from app.database.migrations import apply_schema_upgrades
from app.database.session import AsyncSessionLocal, engine
from app.runtime import run
from app.services.asset_service import refresh_asset_metadata, seed_curated_assets
from app.services.coingecko_service import CoinGeckoService

logger = logging.getLogger(__name__)


async def create_tables() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await apply_schema_upgrades(connection)


async def init_database(coingecko: CoinGeckoService | None = None) -> None:
    await create_tables()
    async with AsyncSessionLocal() as db:
        created = await seed_curated_assets(db)
        updated = await refresh_asset_metadata(db, coingecko) if coingecko is not None else 0
    logger.info("Database ready: %d asset(s) created, %d refreshed from CoinGecko", created, updated)


async def main() -> None:
    coingecko = CoinGeckoService(get_settings())
    try:
        await init_database(coingecko)
    finally:
        await coingecko.aclose()
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run(main())
