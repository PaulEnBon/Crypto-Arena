"""CoinGeckoService behaviour with a mocked HTTP transport (no network)."""

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.exceptions import CoinGeckoRateLimitError, CoinGeckoUnavailableError, CoinNotFoundError
from app.services.coingecko_service import CoinGeckoService


def make_service(handler: Callable[[httpx.Request], httpx.Response], **overrides: Any) -> CoinGeckoService:
    settings = Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        JWT_SECRET="unit-test-secret-key-not-for-production-0123456789",
        COINGECKO_API_KEY="test-key",
        COINGECKO_MAX_RETRIES=0,
        **overrides,
    )
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url=settings.COINGECKO_BASE_URL)
    return CoinGeckoService(settings, client=client)


class Recorder:
    def __init__(self, responses: list[tuple[int, Any]]) -> None:
        self.responses = responses
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        index = min(len(self.requests) - 1, len(self.responses) - 1)
        status, payload = self.responses[index]
        return httpx.Response(status, json=payload)


async def test_demo_api_key_is_sent_as_header() -> None:
    recorder = Recorder([(200, [])])
    service = make_service(recorder)
    await service.get_markets()
    assert recorder.requests[0].headers["x-cg-demo-api-key"] == "test-key"
    assert recorder.requests[0].url.params["vs_currency"] == "eur"


async def test_identical_requests_are_served_from_cache() -> None:
    recorder = Recorder([(200, [{"id": "bitcoin"}])])
    service = make_service(recorder)
    first = await service.get_markets(page=1)
    second = await service.get_markets(page=1)
    assert first == second == [{"id": "bitcoin"}]
    assert len(recorder.requests) == 1
    assert service.stats["cache_hits"] == 1


async def test_stale_cache_is_served_when_upstream_fails() -> None:
    recorder = Recorder([(200, {"id": "bitcoin", "name": "Bitcoin"}), (500, {"error": "boom"})])
    service = make_service(recorder, COINGECKO_CACHE_TTL_COIN=0)  # entries expire immediately
    assert (await service.get_coin("bitcoin"))["name"] == "Bitcoin"
    assert (await service.get_coin("bitcoin"))["name"] == "Bitcoin"  # upstream now returns 500
    assert len(recorder.requests) == 2
    assert service.stats["stale_hits"] == 1


async def test_rate_limit_is_mapped_to_a_dedicated_error() -> None:
    service = make_service(Recorder([(429, {"status": {"error_message": "rate limited"}})]))
    with pytest.raises(CoinGeckoRateLimitError) as info:
        await service.get_trending()
    assert info.value.status_code == 429


async def test_unknown_coin_is_mapped_to_404() -> None:
    service = make_service(Recorder([(404, {"error": "coin not found"})]))
    with pytest.raises(CoinNotFoundError):
        await service.get_coin("does-not-exist")


async def test_network_error_is_mapped_to_503() -> None:
    def broken(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    service = make_service(broken)
    with pytest.raises(CoinGeckoUnavailableError) as info:
        await service.search("bitcoin")
    assert info.value.status_code == 503


async def test_prices_are_cached_per_coin() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        ids = request.url.params["ids"].split(",")
        return httpx.Response(200, json={cid: {"eur": 1.0 + len(cid)} for cid in ids})

    calls: list[str] = []

    def recording_handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.params["ids"])
        return handler(request)

    service = make_service(recording_handler)
    await service.get_simple_prices(["bitcoin"])
    prices = await service.get_simple_prices(["bitcoin", "ethereum"])
    assert set(prices) == {"bitcoin", "ethereum"}
    assert calls == ["bitcoin", "ethereum"]  # second call only fetched the missing coin


async def test_cache_key_is_order_independent() -> None:
    recorder = Recorder([(200, json.loads("[]"))])
    service = make_service(recorder)
    await service.get_markets(ids=["ethereum", "bitcoin"])
    await service.get_markets(ids=["bitcoin", "ethereum"])
    assert len(recorder.requests) == 1
