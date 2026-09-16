from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

TransactionTypeLiteral = Literal["BUY", "SELL"]
PriceSource = Literal["live", "fallback"]


class PortfolioAsset(BaseModel):
    asset_id: int
    coin_id: str
    symbol: str
    name: str
    image_url: str | None = None
    quantity: float
    avg_buy_price: float
    current_price: float
    price_change_24h: float | None = None
    price_source: PriceSource = "live"
    value: float
    invested: float
    profit_loss: float
    profit_loss_pct: float
    allocation_pct: float


class PortfolioSummary(BaseModel):
    cash_balance: float
    initial_balance: float
    invested_amount: float
    holdings_value: float
    total_value: float
    profit_loss: float
    performance_pct: float
    assets: list[PortfolioAsset]
    updated_at: datetime


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coin_id: str
    symbol: str
    name: str
    image_url: str | None = None
    type: TransactionTypeLiteral
    quantity: float
    price: float
    total: float
    created_at: datetime


class SnapshotOut(BaseModel):
    total_value: float
    profit_loss: float
    created_at: datetime


class SnapshotsResponse(BaseModel):
    days: int
    initial_balance: float
    points: list[SnapshotOut]
