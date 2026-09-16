from fastapi import APIRouter
from sqlalchemy import func, select

from app.auth.dependencies import CoinGecko, CurrentUser, DbSession
from app.exceptions import ConflictError
from app.models import User
from app.schemas.user import ProfileResponse, UpdateProfileRequest, UserPublic
from app.services.leaderboard_service import compute_ranking, find_rank, invalidate_ranking_cache
from app.services.portfolio_service import build_portfolio_summary, count_transactions

router = APIRouter(prefix="/profile", tags=["Profil"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: CurrentUser, db: DbSession, coingecko: CoinGecko) -> ProfileResponse:
    summary = await build_portfolio_summary(db, user, coingecko)
    ranking = await compute_ranking(db, coingecko)
    entry = find_rank(ranking, user.id)
    return ProfileResponse(
        user=UserPublic.model_validate(user),
        initial_balance=summary.initial_balance,
        cash_balance=summary.cash_balance,
        portfolio_value=summary.total_value,
        profit_loss=summary.profit_loss,
        performance_pct=summary.performance_pct,
        transactions_count=await count_transactions(db, user.id),
        rank=entry.rank if entry else None,
        total_players=len(ranking.entries),
    )


@router.patch("", response_model=UserPublic)
async def update_profile(data: UpdateProfileRequest, user: CurrentUser, db: DbSession) -> UserPublic:
    """Change the username (must stay unique, case-insensitively)."""
    taken = await db.scalar(
        select(User.id).where(func.lower(User.username) == data.username.lower(), User.id != user.id)
    )
    if taken is not None:
        raise ConflictError("Ce nom d'utilisateur est déjà pris.", code="USERNAME_TAKEN")
    user.username = data.username
    await db.commit()
    await db.refresh(user)
    invalidate_ranking_cache()
    return UserPublic.model_validate(user)
