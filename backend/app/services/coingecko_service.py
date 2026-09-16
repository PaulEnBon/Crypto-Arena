"""Single gateway to the CoinGecko REST API (https://docs.coingecko.com/).

Nothing else in the application talks to CoinGecko. The service provides:
- one shared httpx.AsyncClient (connection pooling, explicit timeouts);
- Demo-plan authentication through the `x-cg-demo-api-key` header;
- an in-memory TTL cache keyed by endpoint + parameters (TTL configurable per endpoint);
- per-coin price caching so the trade engine and the portfolio valuation share the same quote;
- "single-flight": concurrent identical requests share one upstream call;
- bounded concurrency (semaphore) and limited retries with back-off on transient errors;
- stale-while-error: if CoinGecko fails and an expired entry exists, the stale value is served.
"""

import asyncio
import logging
import random
from collections.abc import Iterable
from typing import Any

import httpx

from app.config import Settings
from app.exceptions import (
    CoinGeckoError,
    CoinGeckoRateLimitError,
    CoinGeckoUnavailableError,
    CoinNotFoundError,
)
from app.services.cache import TTLCache

logger = logging.getLogger(__name__)

VS_CURRENCY = "eur"
PRICE_BATCH_SIZE = 100
MAX_RETRY_AFTER_SECONDS = 5.0


class CoinGeckoService:
    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
        cache: TTLCache | None = None,
    ) -> None:
        self._settings = settings
        headers = {"Accept": "application/json", "User-Agent": "CryptoArena/1.0 (+student project)"}
        if settings.COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = settings.COINGECKO_API_KEY
        self._client = client or httpx.AsyncClient(
            base_url=settings.COINGECKO_BASE_URL,
            timeout=httpx.Timeout(settings.COINGECKO_TIMEOUT_SECONDS),
        )
        self._client.headers.update(headers)  # applied even to an injected client (tests)
        self._owns_client = client is None
        self._cache = cache or TTLCache()
        self._inflight: dict[str, asyncio.Future[Any]] = {}
        self._semaphore = asyncio.Semaphore(settings.COINGECKO_MAX_CONCURRENCY)
        self.stats: dict[str, int] = {"requests": 0, "cache_hits": 0, "stale_hits": 0, "errors": 0}

    # ------------------------------------------------------------------ public API

    async def get_markets(
        self,
        page: int = 1,
        per_page: int = 50,
        order: str = "market_cap_desc",
        ids: Iterable[str] | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "vs_currency": VS_CURRENCY,
            "order": order,
            "per_page": per_page,
            "page": page,
            "sparkline": "true",
            "price_change_percentage": "24h,7d",
        }
        if ids:
            params["ids"] = ",".join(sorted(set(ids)))
        data = await self._get_json("/coins/markets", params, self._settings.COINGECKO_CACHE_TTL_MARKETS)
        return data if isinstance(data, list) else []

    async def get_simple_prices(self, ids: Iterable[str]) -> dict[str, dict[str, Any]]:
        """Return {coin_id: {"eur": price, "eur_24h_change": pct, ...}} for the requested ids.

        Prices are cached per coin so that every part of the app (trades, portfolio,
        leaderboard) shares the same quote for the duration of the TTL.
        """
        unique_ids = sorted(set(ids))
        result: dict[str, dict[str, Any]] = {}
        missing: list[str] = []
        for coin_id in unique_ids:
            cached = self._cache.get(self._price_key(coin_id))
            if cached is not None:
                self.stats["cache_hits"] += 1
                result[coin_id] = cached
            else:
                missing.append(coin_id)

        for start in range(0, len(missing), PRICE_BATCH_SIZE):
            batch = missing[start : start + PRICE_BATCH_SIZE]
            result.update(await self._fetch_price_batch(batch))
        return result

    async def get_coin(self, coin_id: str) -> dict[str, Any]:
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "false",
            "developer_data": "false",
            "sparkline": "false",
        }
        data = await self._get_json(f"/coins/{coin_id}", params, self._settings.COINGECKO_CACHE_TTL_COIN)
        return data if isinstance(data, dict) else {}

    async def get_history(self, coin_id: str, days: int) -> dict[str, Any]:
        params = {"vs_currency": VS_CURRENCY, "days": days}
        data = await self._get_json(
            f"/coins/{coin_id}/market_chart", params, self._settings.COINGECKO_CACHE_TTL_HISTORY
        )
        return data if isinstance(data, dict) else {}

    async def search(self, query: str) -> dict[str, Any]:
        data = await self._get_json("/search", {"query": query}, self._settings.COINGECKO_CACHE_TTL_SEARCH)
        return data if isinstance(data, dict) else {}

    async def get_trending(self) -> dict[str, Any]:
        data = await self._get_json("/search/trending", {}, self._settings.COINGECKO_CACHE_TTL_TRENDING)
        return data if isinstance(data, dict) else {}

    async def ping(self) -> dict[str, Any]:
        """Uncached liveness probe used by GET /api/health/coingecko."""
        data = await self._fetch_with_retry("/ping", {}, retries=0)
        return data if isinstance(data, dict) else {}

    def cache_size(self) -> int:
        return len(self._cache)

    def clear_cache(self) -> None:
        self._cache.clear()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------ internals

    @staticmethod
    def _price_key(coin_id: str) -> str:
        return f"price:{coin_id}"

    @staticmethod
    def _cache_key(path: str, params: dict[str, Any]) -> str:
        serialised = "&".join(f"{key}={params[key]}" for key in sorted(params))
        return f"{path}?{serialised}"

    async def _fetch_price_batch(self, batch: list[str]) -> dict[str, dict[str, Any]]:
        params = {
            "ids": ",".join(batch),
            "vs_currencies": VS_CURRENCY,
            "include_24hr_change": "true",
            "include_market_cap": "true",
            "include_last_updated_at": "true",
        }
        try:
            data = await self._fetch_with_retry("/simple/price", params)
        except CoinGeckoError:
            stale = {coin_id: self._cache.get_stale(self._price_key(coin_id)) for coin_id in batch}
            if all(value is not None for value in stale.values()):
                logger.warning("CoinGecko unavailable, serving stale prices for %s", batch)
                self.stats["stale_hits"] += len(batch)
                return {coin_id: value for coin_id, value in stale.items() if value is not None}
            raise

        prices: dict[str, dict[str, Any]] = {}
        if isinstance(data, dict):
            for coin_id in batch:
                payload = data.get(coin_id)
                if isinstance(payload, dict) and payload.get(VS_CURRENCY) is not None:
                    self._cache.set(self._price_key(coin_id), payload, self._settings.COINGECKO_CACHE_TTL_PRICES)
                    prices[coin_id] = payload
        return prices

    async def _get_json(self, path: str, params: dict[str, Any], ttl: int) -> Any:
        key = self._cache_key(path, params)
        cached = self._cache.get(key)
        if cached is not None:
            self.stats["cache_hits"] += 1
            return cached

        inflight = self._inflight.get(key)
        if inflight is not None:
            try:
                return await asyncio.shield(inflight)
            except asyncio.CancelledError:
                if inflight.cancelled():
                    # The request that led the fetch was cancelled: fetch ourselves.
                    return await self._get_json(path, params, ttl)
                raise

        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        self._inflight[key] = future
        try:
            data = await self._fetch_with_retry(path, params)
            self._cache.set(key, data, ttl)
            future.set_result(data)
            return data
        except CoinGeckoError as exc:
            stale = self._cache.get_stale(key)
            if stale is not None:
                logger.warning("CoinGecko error (%s) on %s, serving stale cache", exc.code, path)
                self.stats["stale_hits"] += 1
                future.set_result(stale)
                return stale
            future.set_exception(exc)
            future.exception()  # mark as retrieved so asyncio does not log a warning
            raise
        finally:
            if not future.done():
                future.cancel()
            self._inflight.pop(key, None)

    async def _fetch_with_retry(self, path: str, params: dict[str, Any], retries: int | None = None) -> Any:
        attempts = (self._settings.COINGECKO_MAX_RETRIES if retries is None else retries) + 1
        last_error: CoinGeckoError = CoinGeckoUnavailableError("CoinGecko est indisponible.")
        for attempt in range(attempts):
            delay = min(0.5 * (2**attempt), 4.0) + random.uniform(0, 0.25)
            try:
                async with self._semaphore:
                    self.stats["requests"] += 1
                    response = await self._client.get(path, params=params)
            except httpx.TimeoutException:
                last_error = CoinGeckoUnavailableError("CoinGecko ne répond pas (délai dépassé).")
            except httpx.HTTPError as exc:
                logger.warning("CoinGecko network error on %s: %s", path, exc)
                last_error = CoinGeckoUnavailableError("Impossible de joindre CoinGecko.")
            else:
                status = response.status_code
                if status == 200:
                    return response.json()
                if status == 404:
                    raise CoinNotFoundError("Cryptomonnaie introuvable sur CoinGecko.")
                if status in (401, 403):
                    raise CoinGeckoError("Accès CoinGecko refusé : vérifiez la clé API (COINGECKO_API_KEY).")
                if status == 429:
                    last_error = CoinGeckoRateLimitError(
                        "Limite d'appels CoinGecko atteinte, réessayez dans quelques instants."
                    )
                    delay = self._retry_after(response, default=delay)
                elif status >= 500:
                    last_error = CoinGeckoError(f"CoinGecko a renvoyé une erreur serveur ({status}).")
                else:
                    raise CoinGeckoError(f"Réponse inattendue de CoinGecko ({status}).")

            if attempt < attempts - 1:
                await asyncio.sleep(delay)

        self.stats["errors"] += 1
        raise last_error

    @staticmethod
    def _retry_after(response: httpx.Response, default: float) -> float:
        header = response.headers.get("Retry-After")
        if header and header.isdigit():
            return min(float(header), MAX_RETRY_AFTER_SECONDS)
        return default
