from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.holding import Holding
    from app.models.transaction import Transaction


class Asset(Base):
    """A tradable cryptocurrency, identified by its CoinGecko id (e.g. "bitcoin")."""

    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    coingecko_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    holdings: Mapped[list["Holding"]] = relationship(back_populates="asset")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="asset")

    def __repr__(self) -> str:
        return f"<Asset {self.coingecko_id} ({self.symbol})>"
