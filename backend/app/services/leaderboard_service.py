"""Global ranking computed server-side from live prices.

performance_pct = (portfolio_value - initial_balance) / initial_balance * 100

The full ranking is recomputed at most every LEADERBOARD_CACHE_TTL seconds (and
invalidated after each trade) with exactly three queries + one CoinGecko call.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Asset, Holding, Portfolio, User
from app.schemas.common import Paginated
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse, MyRankResponse
from app.services.cache import TTLCache
from app.services.coingecko_service import CoinGeckoService
from app.services.portfolio_service import fetch_prices, money, pct, quote_price

RANKING_KEY = "ranking"
_ranking_cache = TTLCache(max_entries=4)


@dataclass(slots=True)
class RankedUser:
    rank: int
    user_id: int
    username: str
    initial_balance: Decimal
    portfolio_value: Decimal
    profit_loss: Decimal
    performance_pct: float


@dataclass(slots=True)
class Ranking:
    entries: list[RankedUser]
    computed_at: datetime


def invalidate_ranking_cache() -> None:
    _ranking_cache.delete(RANKING_KEY)


async def compute_ranking(db: AsyncSession, coingecko: CoinGeckoService, *, use_cache: bool = True) -> Ranking:
    if use_cache:
        cached = _ranking_cache.get(RANKING_KEY)
        if isinstance(cached, Ranking):
            return cached

    portfolios = (
        await db.execute(
            select(User.id, User.username, Portfolio.id, Portfolio.cash_balance, Portfolio.initial_balance).join(
                Portfolio, Portfolio.user_id == User.id
            )
        )
    ).all()
    holdings = (
        await db.execute(
            select(Holding.portfolio_id, Holding.quantity, Holding.avg_buy_price, Asset.coingecko_id)
            .join(Asset, Asset.id == Holding.asset_id)
            .where(Holding.quantity > 0)
        )
    ).all()

    quotes, _ = await fetch_prices(coingecko, sorted({row.coingecko_id for row in holdings}))

    holdings_value: dict[int, Decimal] = {}
    for portfolio_id, quantity, avg_buy_price, coingecko_id in holdings:
        price = quote_price(quotes.get(coingecko_id)) or avg_buy_price
        holdings_value[portfolio_id] = holdings_value.get(portfolio_id, Decimal("0")) + quantity * price

    unranked: list[RankedUser] = []
    for user_id, username, portfolio_id, cash_balance, initial_balance in portfolios:
        value = cash_balance + holdings_value.get(portfolio_id, Decimal("0"))
        profit_loss = value - initial_balance
        unranked.append(
            RankedUser(
                rank=0,
                user_id=user_id,
                username=username,
                initial_balance=initial_balance,
                portfolio_value=value,
                profit_loss=profit_loss,
                performance_pct=pct(profit_loss, initial_balance),
            )
        )

    unranked.sort(key=lambda entry: (-entry.performance_pct, -entry.portfolio_value, entry.username.lower()))
    for position, entry in enumerate(unranked, start=1):
        entry.rank = position

    ranking = Ranking(entries=unranked, computed_at=datetime.now(timezone.utc))
    _ranking_cache.set(RANKING_KEY, ranking, get_settings().LEADERBOARD_CACHE_TTL)
    return ranking


def to_entry(entry: RankedUser, current_user_id: int) -> LeaderboardEntry:
    return LeaderboardEntry(
        rank=entry.rank,
        user_id=entry.user_id,
        username=entry.username,
        initial_balance=money(entry.initial_balance),
        portfolio_value=money(entry.portfolio_value),
        profit_loss=money(entry.profit_loss),
        performance_pct=entry.performance_pct,
        is_current_user=entry.user_id == current_user_id,
    )


def paginate_ranking(ranking: Ranking, page: int, page_size: int, current_user_id: int) -> LeaderboardResponse:
    start = (page - 1) * page_size
    items = [to_entry(entry, current_user_id) for entry in ranking.entries[start : start + page_size]]
    base = Paginated[LeaderboardEntry].build(items=items, page=page, page_size=page_size, total=len(ranking.entries))
    return LeaderboardResponse(
        **base.model_dump(), total_players=len(ranking.entries), computed_at=ranking.computed_at
    )


def find_rank(ranking: Ranking, user_id: int) -> RankedUser | None:
    return next((entry for entry in ranking.entries if entry.user_id == user_id), None)


def my_rank_response(ranking: Ranking, user_id: int) -> MyRankResponse:
    entry = find_rank(ranking, user_id)
    if entry is None:
        return MyRankResponse(
            rank=None, total_players=len(ranking.entries), portfolio_value=0.0, profit_loss=0.0, performance_pct=0.0
        )
    return MyRankResponse(
        rank=entry.rank,
        total_players=len(ranking.entries),
        portfolio_value=money(entry.portfolio_value),
        profit_loss=money(entry.profit_loss),
        performance_pct=entry.performance_pct,
    )
