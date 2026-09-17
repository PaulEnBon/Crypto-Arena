from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, utcnow

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio
    from app.models.snapshot import PortfolioSnapshot
    from app.models.transaction import Transaction


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # For Google / GitHub accounts this holds an unusable marker (see auth.security.make_unusable_password).
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Neon Auth user id (JWT `sub`) for accounts linked to Google / GitHub; NULL for email + password only.
    neon_auth_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    # Demo/seed accounts are flagged so they can be identified and purged independently of real users.
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    snapshots: Mapped[list["PortfolioSnapshot"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"
