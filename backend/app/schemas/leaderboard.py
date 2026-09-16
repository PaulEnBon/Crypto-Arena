from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import Paginated


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    initial_balance: float
    portfolio_value: float
    profit_loss: float
    performance_pct: float
    is_current_user: bool = False


class LeaderboardResponse(Paginated[LeaderboardEntry]):
    total_players: int
    computed_at: datetime


class MyRankResponse(BaseModel):
    rank: int | None
    total_players: int
    portfolio_value: float
    profit_loss: float
    performance_pct: float
