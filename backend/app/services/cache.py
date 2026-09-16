"""Small in-memory TTL cache used to protect CoinGecko's rate limits.

A single process/instance is enough for this project; a shared cache (Redis)
would be the natural next step when scaling to several backend instances.
"""

import time
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class CacheEntry:
    value: Any
    stored_at: float
    expires_at: float


class TTLCache:
    def __init__(self, max_entries: int = 2000) -> None:
        self._entries: dict[str, CacheEntry] = {}
        self._max_entries = max_entries

    def get(self, key: str) -> Any | None:
        """Return the cached value if it exists and is still fresh, otherwise None."""
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= time.monotonic():
            return None
        return entry.value

    def get_stale(self, key: str) -> Any | None:
        """Return the cached value even if it expired (fallback when the upstream API fails)."""
        entry = self._entries.get(key)
        return entry.value if entry is not None else None

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        now = time.monotonic()
        if len(self._entries) >= self._max_entries and key not in self._entries:
            self._evict(now)
        self._entries[key] = CacheEntry(value=value, stored_at=now, expires_at=now + ttl_seconds)

    def delete(self, key: str) -> None:
        self._entries.pop(key, None)

    def clear(self) -> None:
        self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)

    def _evict(self, now: float) -> None:
        expired = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in expired:
            del self._entries[key]
        if len(self._entries) >= self._max_entries:
            oldest = min(self._entries, key=lambda k: self._entries[k].stored_at)
            del self._entries[oldest]
