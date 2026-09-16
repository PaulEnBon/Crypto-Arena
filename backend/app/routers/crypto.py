"""Market data proxied from CoinGecko. The API key never leaves the backend."""

from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query

from app.auth.dependencies import CoinGecko
from app.schemas.crypto import (
    CoinDetail,
    CoinHistory,
    MarketCoin,
    MarketsResponse,
    PricesResponse,
    SearchResponse,
    SimplePrice,
    TrendingResponse,
)
from app.schemas.trade import COIN_ID_PATTERN

router = APIRouter(prefix="/crypto", tags=["Cryptomonnaies (CoinGecko)"])

MarketOrder = Literal["market_cap_desc", "market_cap_asc", "volume_desc", "volume_asc", "id_asc", "id_desc"]
IDS_PATTERN = r"^[a-z0-9._-]+(,[a-z0-9._-]+)*$"
MAX_IDS = 100

CoinId = Annotated[str, Path(pattern=COIN_ID_PATTERN, description="Identifiant CoinGecko, ex: bitcoin")]


def parse_ids(ids: str | None) -> list[str]:
    if not ids:
        return []
    return sorted({value for value in ids.split(",") if value})[:MAX_IDS]


@router.get("/markets", response_model=MarketsResponse)
async def list_markets(
    coingecko: CoinGecko,
    page: Annotated[int, Query(ge=1, le=50)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
    order: MarketOrder = "market_cap_desc",
    ids: Annotated[str | None, Query(pattern=IDS_PATTERN, description="Liste d'ids séparés par des virgules")] = None,
) -> MarketsResponse:
    id_list = parse_ids(ids)
    raw = await coingecko.get_markets(page=page, per_page=per_page, order=order, ids=id_list or None)
    coins = [MarketCoin.from_coingecko(item) for item in raw if isinstance(item, dict) and item.get("id")]
    return MarketsResponse(
        page=page, per_page=per_page, order=order, coins=coins, has_next=not id_list and len(coins) == per_page
    )


@router.get("/trending", response_model=TrendingResponse)
async def trending(coingecko: CoinGecko) -> TrendingResponse:
    return TrendingResponse.from_coingecko(await coingecko.get_trending())


@router.get("/search", response_model=SearchResponse)
async def search(coingecko: CoinGecko, q: Annotated[str, Query(min_length=1, max_length=50)]) -> SearchResponse:
    query = q.strip()
    return SearchResponse.from_coingecko(query, await coingecko.search(query))


@router.get("/prices", response_model=PricesResponse)
async def prices(coingecko: CoinGecko, ids: Annotated[str, Query(pattern=IDS_PATTERN)]) -> PricesResponse:
    quotes = await coingecko.get_simple_prices(parse_ids(ids))
    items = [
        SimplePrice(
            coin_id=coin_id,
            price=float(quote["eur"]),
            change_24h=quote.get("eur_24h_change"),
            market_cap=quote.get("eur_market_cap"),
            last_updated_at=quote.get("last_updated_at"),
        )
        for coin_id, quote in sorted(quotes.items())
        if isinstance(quote.get("eur"), (int, float))
    ]
    return PricesResponse(prices=items)


@router.get("/{coin_id}", response_model=CoinDetail)
async def coin_detail(coin_id: CoinId, coingecko: CoinGecko) -> CoinDetail:
    return CoinDetail.from_coingecko(await coingecko.get_coin(coin_id))


@router.get("/{coin_id}/history", response_model=CoinHistory)
async def coin_history(
    coin_id: CoinId, coingecko: CoinGecko, days: Annotated[int, Query(ge=1, le=365)] = 7
) -> CoinHistory:
    return CoinHistory.from_coingecko(coin_id, days, await coingecko.get_history(coin_id, days))
