from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, utcnow

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.portfolio import Portfolio


class Holding(Base):
    """Current position of a portfolio on one asset (quantity + average buy price).

    Holdings are derived from transactions but stored explicitly so that reads,
    valuation and row-level locking during trades stay cheap and correct.
    """

    __tablename__ = "holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "asset_id", name="uq_holdings_portfolio_asset"),
        CheckConstraint("quantity >= 0", name="ck_holdings_quantity_non_negative"),
        CheckConstraint("avg_buy_price >= 0", name="ck_holdings_avg_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(28, 8), nullable=False, default=Decimal("0"))
    avg_buy_price: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False, default=Decimal("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")
    asset: Mapped["Asset"] = relationship(back_populates="holdings", lazy="joined")

    def __repr__(self) -> str:
        return f"<Holding portfolio={self.portfolio_id} asset={self.asset_id} qty={self.quantity}>"
