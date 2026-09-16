from httpx import AsyncClient

from tests.conftest import FakeCoinGecko, bearer, register


async def test_portfolio_summary_is_valued_with_live_prices(
    auth_client: AsyncClient, fake_coingecko: FakeCoinGecko
) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1})
    fake_coingecko.prices["bitcoin"] = 55000.0

    response = await auth_client.get("/api/portfolio")
    assert response.status_code == 200
    body = response.json()
    assert body["cash_balance"] == 5000.0
    assert body["holdings_value"] == 5500.0
    assert body["total_value"] == 10500.0
    assert body["profit_loss"] == 500.0
    assert body["performance_pct"] == 5.0
    asset = body["assets"][0]
    assert asset["price_source"] == "live"
    assert asset["profit_loss_pct"] == 10.0
    assert asset["allocation_pct"] == 52.38


async def test_portfolio_degrades_gracefully_when_prices_are_unavailable(
    auth_client: AsyncClient, fake_coingecko: FakeCoinGecko
) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1})
    fake_coingecko.fail_prices = True

    response = await auth_client.get("/api/portfolio")
    assert response.status_code == 200
    body = response.json()
    assert body["assets"][0]["price_source"] == "fallback"
    assert body["assets"][0]["current_price"] == 50000.0  # average buy price used as fallback
    assert body["total_value"] == 10000.0


async def test_snapshots_are_recorded_after_trades(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1})
    response = await auth_client.get("/api/portfolio/snapshots?days=7")
    assert response.status_code == 200
    body = response.json()
    assert body["initial_balance"] == 10000.0
    assert len(body["points"]) == 1
    assert body["points"][0]["total_value"] == 10000.0


async def test_transactions_are_paginated(auth_client: AsyncClient) -> None:
    for _ in range(3):
        await auth_client.post("/api/trades/buy", json={"coin_id": "solana", "quantity": 1})
    response = await auth_client.get("/api/portfolio/transactions?page=2&page_size=2")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["total_pages"] == 2
    assert body["page"] == 2
    assert len(body["items"]) == 1


async def test_leaderboard_ranks_by_performance_and_flags_current_user(
    client: AsyncClient, fake_coingecko: FakeCoinGecko
) -> None:
    alice = await register(client, "alice", "alice@cryptoarena.dev")
    bob = await register(client, "bob", "bob@cryptoarena.dev")
    carol = await register(client, "carol", "carol@cryptoarena.dev")

    await client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.1}, headers=bearer(alice["access_token"]))
    await client.post("/api/trades/buy", json={"coin_id": "ethereum", "quantity": 1}, headers=bearer(carol["access_token"]))
    fake_coingecko.prices["bitcoin"] = 60000.0  # alice: +1000 € (+10 %)
    fake_coingecko.prices["ethereum"] = 1500.0  # carol: -500 € (-5 %)

    response = await client.get("/api/leaderboard?page_size=10", headers=bearer(bob["access_token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["total_players"] == 3
    ranks = [(entry["rank"], entry["username"], entry["performance_pct"]) for entry in body["items"]]
    assert ranks == [(1, "alice", 10.0), (2, "bob", 0.0), (3, "carol", -5.0)]
    assert [entry["is_current_user"] for entry in body["items"]] == [False, True, False]

    mine = await client.get("/api/leaderboard/me", headers=bearer(carol["access_token"]))
    assert mine.status_code == 200
    assert mine.json()["rank"] == 3
    assert mine.json()["performance_pct"] == -5.0


async def test_profile_exposes_statistics(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/trades/buy", json={"coin_id": "bitcoin", "quantity": 0.05})
    await auth_client.post("/api/trades/sell", json={"coin_id": "bitcoin", "quantity": 0.01})

    response = await auth_client.get("/api/profile")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "alice"
    assert body["transactions_count"] == 2
    assert body["rank"] == 1
    assert body["total_players"] == 1
    assert body["initial_balance"] == 10000.0


async def test_profile_username_update_and_uniqueness(client: AsyncClient) -> None:
    alice = await register(client, "alice", "alice@cryptoarena.dev")
    await register(client, "bob", "bob@cryptoarena.dev")

    renamed = await client.patch("/api/profile", json={"username": "Alice_Pro"}, headers=bearer(alice["access_token"]))
    assert renamed.status_code == 200
    assert renamed.json()["username"] == "Alice_Pro"

    conflict = await client.patch("/api/profile", json={"username": "BOB"}, headers=bearer(alice["access_token"]))
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "USERNAME_TAKEN"
