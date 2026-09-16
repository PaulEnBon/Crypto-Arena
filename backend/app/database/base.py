"""Declarative base shared by every ORM model."""

from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp used as Python-side default for created_at columns."""
    return datetime.now(timezone.utc)
