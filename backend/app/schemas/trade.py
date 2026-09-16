from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.portfolio import PortfolioSummary, TransactionOut

COIN_ID_PATTERN = r"^[a-z0-9._-]{1,100}$"


class TradeRequest(BaseModel):
    """The client only sends what it wants; the price is always resolved server-side."""

    coin_id: str = Field(pattern=COIN_ID_PATTERN, examples=["bitcoin"])
    quantity: Decimal = Field(gt=0, max_digits=28, decimal_places=8, examples=[0.01])


class TradeResponse(BaseModel):
    message: str
    transaction: TransactionOut
    portfolio: PortfolioSummary
