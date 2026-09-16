"""Liveness endpoints, including a CoinGecko probe that mirrors the upstream status code."""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import text

from app.auth.dependencies import CoinGecko, DbSession
from app.config import get_settings
from app.exceptions import CoinGeckoError, CoinGeckoRateLimitError, CoinGeckoUnavailableError
from app.schemas.health import CoinGeckoHealthResponse, HealthResponse

router = APIRouter(prefix="/health", tags=["Santé"])


@router.get("", response_model=HealthResponse)
async def health(db: DbSession, response: Response) -> HealthResponse:
    settings = get_settings()
    try:
        await db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001 - any driver error means the database is unreachable
        database = "error"
        response.status_code = 503
    return HealthResponse(
        status="ok" if database == "ok" else "degraded",
        app=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=database,
        timestamp=datetime.now(timezone.utc),
    )


@router.get(
    "/coingecko",
    response_model=CoinGeckoHealthResponse,
    responses={429: {"description": "Limite CoinGecko atteinte"}, 500: {"description": "Erreur CoinGecko"}, 503: {"description": "CoinGecko indisponible"}},
)
async def coingecko_health(coingecko: CoinGecko, response: Response) -> CoinGeckoHealthResponse:
    """200 = API disponible, 429 = limite atteinte, 500 = erreur CoinGecko, 503 = service indisponible."""
    started = time.perf_counter()
    try:
        payload = await coingecko.ping()
        status, http_status = "ok", 200
        message = str(payload.get("gecko_says", "CoinGecko répond."))
    except CoinGeckoRateLimitError as exc:
        status, http_status, message = "rate_limited", 429, exc.detail
    except CoinGeckoUnavailableError as exc:
        status, http_status, message = "unavailable", 503, exc.detail
    except CoinGeckoError as exc:
        status, http_status, message = "error", 500, exc.detail

    response.status_code = http_status
    return CoinGeckoHealthResponse(
        status=status,
        http_status=http_status,
        latency_ms=round((time.perf_counter() - started) * 1000, 1),
        message=message,
        cache_entries=coingecko.cache_size(),
        stats=dict(coingecko.stats),
    )
