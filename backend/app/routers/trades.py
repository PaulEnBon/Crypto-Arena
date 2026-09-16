from fastapi import APIRouter, status

from app.auth.dependencies import CoinGecko, CurrentUser, DbSession
from app.models import TransactionType
from app.schemas.trade import TradeRequest, TradeResponse
from app.services.trade_service import execute_trade

router = APIRouter(prefix="/trades", tags=["Trading"])


@router.post("/buy", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def buy(data: TradeRequest, user: CurrentUser, db: DbSession, coingecko: CoinGecko) -> TradeResponse:
    """Buy `quantity` of `coin_id` at the current CoinGecko price (resolved server-side)."""
    return await execute_trade(db, user, data.coin_id, data.quantity, TransactionType.BUY, coingecko)


@router.post("/sell", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def sell(data: TradeRequest, user: CurrentUser, db: DbSession, coingecko: CoinGecko) -> TradeResponse:
    """Sell `quantity` of `coin_id` at the current CoinGecko price (resolved server-side)."""
    return await execute_trade(db, user, data.coin_id, data.quantity, TransactionType.SELL, coingecko)
