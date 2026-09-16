from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.exceptions import InvalidQuantityError
from app.services.trade_service import apply_buy, compute_total, validate_quantity
from tests.conftest import FakeCoinGecko


# ---------------------------------------------------------------- pure functions


def test_apply_buy_uses_average_cost_method() -> None:
    qty, avg = apply_buy(Decimal("1"), Decimal("100"), Decimal("1"), Decimal("200"))
    assert qty == Decimal("2")
    assert avg == Decimal("150")


def test_compute_total_rounds_to_the_cent() -> None:
    assert compute_total(Decimal("0.025"), Decimal("102421.111")) == Decimal("2560.53")


@pytest.mark.parametrize("value", [Decimal("0"), Decimal("-1"), Decimal("0.000000001"), Decimal("1e12")])
def test_validate_quantity_rejects_invalid_values(value: Decimal) -> None:
    with pytest.raises(InvalidQuantityError):
        validate_quantity(value)


# ---------------------------------------------------------------- HTTP flow


async def test_buy_updates_cash_holdings_and_history(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1})
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["transaction"]["type"] == "BUY"
    assert body["transaction"]["price"] == 50000.0
    assert body["transaction"]["total"] == 5000.0
    assert body["portfolio"]["cash_balance"] == 5000.0
    assert body["portfolio"]["assets"][0]["coin_id"] == "bitcoin"
    assert body["portfolio"]["assets"][0]["quantity"] == 0.1
    assert body["portfolio"]["total_value"] == 10000.0

    history = await auth_client.get("/api/portfolio/transactions")
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["symbol"] == "BTC"


async def test_buy_rejects_insufficient_funds(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 1})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "INSUFFICIENT_FUNDS"
    assert "Fonds insuffisants" in body["detail"]


@pytest.mark.parametrize("quantity", [0, -0.5, 0.000000001, "abc"])
async def test_buy_rejects_invalid_quantity(auth_client: AsyncClient, quantity: object) -> None:
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": quantity})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


async def test_buy_rejects_amount_below_one_cent(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "pepe", "quantity": 1})
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_QUANTITY"


async def test_buy_unknown_coin_returns_404(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "not-a-coin", "quantity": 1})
    assert response.status_code == 404
    assert response.json()["code"] == "COIN_NOT_FOUND"


async def test_buy_fails_when_price_unavailable(auth_client: AsyncClient, fake_coingecko: FakeCoinGecko) -> None:
    fake_coingecko.prices.pop("solana")
    response = await auth_client.post("/api/trades/buy", json={"coin_id": "solana", "quantity": 1})
    assert response.status_code == 502
    assert response.json()["code"] == "INVALID_PRICE"


async def test_sell_more_than_held_is_rejected(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "ethereum", "quantity": 1})
    response = await auth_client.post("/api/trades/sell", json={"coin_id": "ethereum", "quantity": 2})
    assert response.status_code == 400
    assert response.json()["code"] == "INSUFFICIENT_HOLDINGS"

    never_bought = await auth_client.post("/api/trades/sell", json={"coin_id": "bitcoin", "quantity": 0.1})
    assert never_bought.status_code == 400
    assert never_bought.json()["code"] == "INSUFFICIENT_HOLDINGS"


async def test_sell_credits_cash_at_current_price(auth_client: AsyncClient, fake_coingecko: FakeCoinGecko) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1})
    fake_coingecko.prices["bitcoin"] = 60000.0  # price moved up since the purchase

    response = await auth_client.post("/api/trades/sell", json={"coin_id": "bitcoin", "quantity": 0.05})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["transaction"]["type"] == "SELL"
    assert body["transaction"]["total"] == 3000.0
    assert body["portfolio"]["cash_balance"] == 8000.0

    remaining = body["portfolio"]["assets"][0]
    assert remaining["quantity"] == 0.05
    assert remaining["avg_buy_price"] == 50000.0  # average cost is unchanged by a sale
    assert remaining["current_price"] == 60000.0
    assert remaining["profit_loss"] == 500.0


async def test_selling_everything_removes_the_position(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "solana", "quantity": 10})
    response = await auth_client.post("/api/trades/sell", json={"coin_id": "solana", "quantity": 10})
    assert response.status_code == 201
    assert response.json()["portfolio"]["assets"] == []
    assert response.json()["portfolio"]["cash_balance"] == 10000.0
