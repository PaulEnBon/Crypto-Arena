"""Shared generic schemas."""

import math
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    """Generic page envelope reused by transactions, leaderboard, ... (mirrored by Paginated<T> in the frontend)."""

    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], page: int, page_size: int, total: int) -> "Paginated[T]":
        return cls(
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)) if page_size else 1,
        )
