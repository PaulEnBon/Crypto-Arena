from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    environment: str
    database: Literal["ok", "error"]
    timestamp: datetime


class CoinGeckoHealthResponse(BaseModel):
    status: Literal["ok", "rate_limited", "error", "unavailable"]
    http_status: int
    latency_ms: float
    message: str
    cache_entries: int
    stats: dict[str, int]
