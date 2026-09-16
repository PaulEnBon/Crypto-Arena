"""Shared fixtures: in-memory SQLite database, fake CoinGecko service and an HTTP client bound to the app.

The environment is configured *before* importing the application so that Settings
never touches a real database or the network during the test-suite.
"""

import os

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET"] = "unit-test-secret-key-not-for-production-0123456789"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["AUTO_INIT_DB"] = "false"
os.environ["COINGECKO_API_KEY"] = ""
os.environ["LEADERBOARD_CACHE_TTL"] = "0"

from collections.abc import AsyncIterator  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402, F401 - register tables
from app.auth.dependencies import get_coingecko  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.session import get_db  # noqa: E402
from app.exceptions import CoinGeckoUnavailableError, CoinNotFoundError  # noqa: E402
from app.main import app  # noqa: E402

KNOWN_COINS: dict[str, tuple[str, str]] = {
    "bitcoin": ("BTC", "Bitcoin"),
    "ethereum": ("ETH", "Ethereum"),
    "solana": ("SOL", "Solana"),
    "dogecoin": ("DOGE", "Dogecoin"),
    "pepe": ("PEPE", "Pepe"),
}


class FakeCoinGecko:
    """Drop-in replacement for CoinGeckoService with deterministic data and no network."""

    def __init__(self) -> None:
        self.prices: dict[str, float] = {"bitcoin": 50000.0, "ethereum": 2000.0, "solana": 100.0, "pepe": 0.00001}
        self.fail_prices = False
        self.calls: list[tuple[str, Any]] = []
        self.stats = {"requests": 0, "cache_hits": 0, "stale_hits": 0, "errors": 0}

    async def get_simple_prices(self, ids: Any) -> dict[str, dict[str, Any]]:
        wanted = sorted(set(ids))
        self.calls.append(("prices", wanted))
        if self.fail_prices:
            raise CoinGeckoUnavailableError("CoinGecko indisponible (test)")
        return {cid: {"eur": price, "eur_24h_change": 1.5} for cid, price in self.prices.items() if cid in wanted}

    async def get_coin(self, coin_id: str) -> dict[str, Any]:
        self.calls.append(("coin", coin_id))
        if coin_id not in KNOWN_COINS:
            raise CoinNotFoundError("Cryptomonnaie introuvable sur CoinGecko.")
        symbol, name = KNOWN_COINS[coin_id]
        return {
            "id": coin_id,
            "symbol": symbol.lower(),
            "name": name,
            "image": {"small": f"https://img.test/{coin_id}.png", "large": f"https://img.test/{coin_id}.png"},
            "description": {"en": "<p>Test description</p>"},
            "market_data": {"current_price": {"eur": self.prices.get(coin_id, 1.0)}},
        }

    async def get_markets(self, page: int = 1, per_page: int = 50, order: str = "market_cap_desc", ids: Any = None) -> list[dict[str, Any]]:
        self.calls.append(("markets", page))
        return [
            {"id": cid, "symbol": KNOWN_COINS[cid][0].lower(), "name": KNOWN_COINS[cid][1], "current_price": price,
             "market_cap_rank": rank, "sparkline_in_7d": {"price": [1.0, 2.0]}}
            for rank, (cid, price) in enumerate(self.prices.items(), start=1)
            if cid in KNOWN_COINS
        ]

    async def get_history(self, coin_id: str, days: int) -> dict[str, Any]:
        return {"prices": [[1700000000000, 1.0], [1700003600000, 2.0]]}

    async def search(self, query: str) -> dict[str, Any]:
        return {"coins": [{"id": "bitcoin", "name": "Bitcoin", "symbol": "btc", "market_cap_rank": 1}]}

    async def get_trending(self) -> dict[str, Any]:
        return {"coins": [{"item": {"id": "solana", "name": "Solana", "symbol": "sol", "market_cap_rank": 5}}]}

    async def ping(self) -> dict[str, Any]:
        return {"gecko_says": "(V3) To the Moon!"}

    def cache_size(self) -> int:
        return 0

    async def aclose(self) -> None:
        return None


@pytest_asyncio.fixture
async def db_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_connection: Any, _: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def fake_coingecko() -> FakeCoinGecko:
    return FakeCoinGecko()


@pytest_asyncio.fixture
async def client(db_engine: AsyncEngine, fake_coingecko: FakeCoinGecko) -> AsyncIterator[AsyncClient]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_coingecko] = lambda: fake_coingecko
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


async def register(
    client: AsyncClient, username: str = "alice", email: str = "alice@cryptoarena.dev", password: str = "Secret123"
) -> dict[str, Any]:
    response = await client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password, "password_confirm": password},
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """Client already authenticated as `alice` (fresh 10 000 € portfolio)."""
    body = await register(client)
    client.headers.update(bearer(body["access_token"]))
    return client
