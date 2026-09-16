from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.dependencies import CoinGecko, CurrentUser, DbSession
from app.schemas.common import Paginated
from app.schemas.portfolio import PortfolioSummary, SnapshotsResponse, TransactionOut
from app.services.portfolio_service import (
    build_portfolio_summary,
    list_snapshots,
    list_transactions,
    record_snapshot,
)

router = APIRouter(prefix="/portfolio", tags=["Portefeuille"])


@router.get("", response_model=PortfolioSummary)
async def get_portfolio_summary(user: CurrentUser, db: DbSession, coingecko: CoinGecko) -> PortfolioSummary:
    """Portfolio valued with live CoinGecko prices. Also records a throttled performance snapshot."""
    summary = await build_portfolio_summary(db, user, coingecko)
    await record_snapshot(db, user.id, summary)
    return summary


@router.get("/transactions", response_model=Paginated[TransactionOut])
async def get_transactions(
    user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Paginated[TransactionOut]:
    return await list_transactions(db, user.id, page=page, page_size=page_size)


@router.get("/snapshots", response_model=SnapshotsResponse)
async def get_snapshots(
    user: CurrentUser, db: DbSession, days: Annotated[int, Query(ge=1, le=365)] = 30
) -> SnapshotsResponse:
    return await list_snapshots(db, user.id, days=days)
