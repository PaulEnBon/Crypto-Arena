from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.dependencies import CoinGecko, CurrentUser, DbSession
from app.schemas.leaderboard import LeaderboardResponse, MyRankResponse
from app.services.leaderboard_service import compute_ranking, my_rank_response, paginate_ranking

router = APIRouter(prefix="/leaderboard", tags=["Classement"])


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    user: CurrentUser,
    db: DbSession,
    coingecko: CoinGecko,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LeaderboardResponse:
    """Global ranking by performance percentage, computed server-side from live prices."""
    ranking = await compute_ranking(db, coingecko)
    return paginate_ranking(ranking, page=page, page_size=page_size, current_user_id=user.id)


@router.get("/me", response_model=MyRankResponse)
async def get_my_rank(user: CurrentUser, db: DbSession, coingecko: CoinGecko) -> MyRankResponse:
    ranking = await compute_ranking(db, coingecko)
    return my_rank_response(ranking, user.id)
