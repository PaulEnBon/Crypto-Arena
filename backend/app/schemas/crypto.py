"""Trimmed, stable representations of CoinGecko payloads exposed to the frontend."""

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

_HTML_TAG = re.compile(r"<[^>]+>")
DESCRIPTION_MAX_LENGTH = 1500


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _eur(mapping: Any) -> float | None:
    return _to_float(mapping.get("eur")) if isinstance(mapping, dict) else None


class MarketCoin(BaseModel):
    id: str
    symbol: str
    name: str
    image: str | None = None
    current_price: float | None = None
    market_cap: float | None = None
    market_cap_rank: int | None = None
    total_volume: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    price_change_24h: float | None = None
    price_change_percentage_24h: float | None = None
    price_change_percentage_7d: float | None = None
    sparkline_7d: list[float] = Field(default_factory=list)
    last_updated: datetime | None = None

    @classmethod
    def from_coingecko(cls, item: dict[str, Any]) -> "MarketCoin":
        sparkline = item.get("sparkline_in_7d") or {}
        raw_points = sparkline.get("price") if isinstance(sparkline, dict) else None
        points = [p for p in (raw_points or []) if isinstance(p, (int, float))]
        return cls(
            id=str(item["id"]),
            symbol=str(item.get("symbol", "")).upper(),
            name=str(item.get("name", "")),
            image=item.get("image"),
            current_price=_to_float(item.get("current_price")),
            market_cap=_to_float(item.get("market_cap")),
            market_cap_rank=item.get("market_cap_rank"),
            total_volume=_to_float(item.get("total_volume")),
            high_24h=_to_float(item.get("high_24h")),
            low_24h=_to_float(item.get("low_24h")),
            price_change_24h=_to_float(item.get("price_change_24h")),
            price_change_percentage_24h=_to_float(item.get("price_change_percentage_24h")),
            price_change_percentage_7d=_to_float(item.get("price_change_percentage_7d_in_currency")),
            sparkline_7d=[float(p) for p in points],
            last_updated=item.get("last_updated"),
        )


class MarketsResponse(BaseModel):
    page: int
    per_page: int
    order: str
    coins: list[MarketCoin]
    has_next: bool


class CoinDetail(BaseModel):
    id: str
    symbol: str
    name: str
    image: str | None = None
    description: str = ""
    market_cap_rank: int | None = None
    current_price: float | None = None
    price_change_percentage_24h: float | None = None
    price_change_percentage_7d: float | None = None
    price_change_percentage_30d: float | None = None
    market_cap: float | None = None
    total_volume: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    ath: float | None = None
    ath_date: datetime | None = None
    atl: float | None = None
    circulating_supply: float | None = None
    total_supply: float | None = None
    max_supply: float | None = None
    homepage: str | None = None
    genesis_date: str | None = None
    categories: list[str] = Field(default_factory=list)
    last_updated: datetime | None = None

    @classmethod
    def from_coingecko(cls, data: dict[str, Any]) -> "CoinDetail":
        market = data.get("market_data") or {}
        image = data.get("image") or {}
        links = data.get("links") or {}
        homepages = [url for url in (links.get("homepage") or []) if isinstance(url, str) and url]
        descriptions = data.get("description") or {}
        raw_description = descriptions.get("fr") or descriptions.get("en") or ""
        description = _HTML_TAG.sub("", raw_description).strip()
        if len(description) > DESCRIPTION_MAX_LENGTH:
            description = description[:DESCRIPTION_MAX_LENGTH].rsplit(" ", 1)[0] + "…"
        ath_date = market.get("ath_date") or {}
        return cls(
            id=str(data["id"]),
            symbol=str(data.get("symbol", "")).upper(),
            name=str(data.get("name", "")),
            image=image.get("large") or image.get("small"),
            description=description,
            market_cap_rank=data.get("market_cap_rank"),
            current_price=_eur(market.get("current_price")),
            price_change_percentage_24h=_eur(market.get("price_change_percentage_24h_in_currency")),
            price_change_percentage_7d=_eur(market.get("price_change_percentage_7d_in_currency")),
            price_change_percentage_30d=_eur(market.get("price_change_percentage_30d_in_currency")),
            market_cap=_eur(market.get("market_cap")),
            total_volume=_eur(market.get("total_volume")),
            high_24h=_eur(market.get("high_24h")),
            low_24h=_eur(market.get("low_24h")),
            ath=_eur(market.get("ath")),
            ath_date=ath_date.get("eur") if isinstance(ath_date, dict) else None,
            atl=_eur(market.get("atl")),
            circulating_supply=_to_float(market.get("circulating_supply")),
            total_supply=_to_float(market.get("total_supply")),
            max_supply=_to_float(market.get("max_supply")),
            homepage=homepages[0] if homepages else None,
            genesis_date=data.get("genesis_date"),
            categories=[c for c in (data.get("categories") or []) if isinstance(c, str)][:6],
            last_updated=data.get("last_updated"),
        )


class PricePoint(BaseModel):
    timestamp: int
    price: float


class CoinHistory(BaseModel):
    coin_id: str
    vs_currency: str = "eur"
    days: int
    prices: list[PricePoint]

    @classmethod
    def from_coingecko(cls, coin_id: str, days: int, data: dict[str, Any]) -> "CoinHistory":
        points: list[PricePoint] = []
        for entry in data.get("prices") or []:
            if isinstance(entry, list) and len(entry) == 2 and isinstance(entry[1], (int, float)):
                points.append(PricePoint(timestamp=int(entry[0]), price=float(entry[1])))
        return cls(coin_id=coin_id, days=days, prices=points)


class SearchCoin(BaseModel):
    id: str
    name: str
    symbol: str
    market_cap_rank: int | None = None
    thumb: str | None = None
    large: str | None = None


class SearchResponse(BaseModel):
    query: str
    coins: list[SearchCoin]

    @classmethod
    def from_coingecko(cls, query: str, data: dict[str, Any], limit: int = 20) -> "SearchResponse":
        coins = [
            SearchCoin(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                symbol=str(item.get("symbol", "")).upper(),
                market_cap_rank=item.get("market_cap_rank"),
                thumb=item.get("thumb"),
                large=item.get("large"),
            )
            for item in (data.get("coins") or [])[:limit]
            if isinstance(item, dict) and item.get("id")
        ]
        return cls(query=query, coins=coins)


class TrendingCoin(BaseModel):
    id: str
    name: str
    symbol: str
    market_cap_rank: int | None = None
    thumb: str | None = None
    price_change_percentage_24h: float | None = None


class TrendingResponse(BaseModel):
    coins: list[TrendingCoin]

    @classmethod
    def from_coingecko(cls, data: dict[str, Any]) -> "TrendingResponse":
        coins: list[TrendingCoin] = []
        for wrapper in data.get("coins") or []:
            item = wrapper.get("item") if isinstance(wrapper, dict) else None
            if not isinstance(item, dict) or not item.get("id"):
                continue
            extra = item.get("data") or {}
            change = extra.get("price_change_percentage_24h") if isinstance(extra, dict) else None
            coins.append(
                TrendingCoin(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    symbol=str(item.get("symbol", "")).upper(),
                    market_cap_rank=item.get("market_cap_rank"),
                    thumb=item.get("thumb") or item.get("small"),
                    price_change_percentage_24h=_eur(change),
                )
            )
        return cls(coins=coins)


class SimplePrice(BaseModel):
    coin_id: str
    price: float
    change_24h: float | None = None
    market_cap: float | None = None
    last_updated_at: int | None = None


class PricesResponse(BaseModel):
    prices: list[SimplePrice]
