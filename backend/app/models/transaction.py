from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, utcnow

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User


class TransactionType(StrEnum):
    BUY = "BUY"
    SELL = "SELL"


class Transaction(Base):
    """Immutable ledger of every virtual trade. `total` is the cash actually moved (rounded to the cent)."""

    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('BUY', 'SELL')", name="ck_transactions_type"),
        CheckConstraint("quantity > 0", name="ck_transactions_quantity_positive"),
        CheckConstraint("price > 0", name="ck_transactions_price_positive"),
        CheckConstraint("total > 0", name="ck_transactions_total_positive"),
        Index("ix_transactions_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(4), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(28, 8), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="transactions")
    asset: Mapped["Asset"] = relationship(back_populates="transactions", lazy="joined")

    def __repr__(self) -> str:
        return f"<Transaction {self.type} {self.quantity} asset={self.asset_id} total={self.total}>"
