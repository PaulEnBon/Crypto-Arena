"""Async engine + session factory. `get_db` is the FastAPI dependency used by every router."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()


def _build_engine() -> AsyncEngine:
    url = settings.sqlalchemy_url
    if url.startswith("sqlite"):
        # SQLite is only used by the automated test-suite (see tests/conftest.py).
        return create_async_engine(url, echo=settings.DEBUG)
    return create_async_engine(url, echo=settings.DEBUG, pool_pre_ping=True, pool_size=5, max_overflow=10)


engine: AsyncEngine = _build_engine()

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a session per request; roll back if the request raised, always close."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
