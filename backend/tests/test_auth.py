from httpx import AsyncClient

from app.auth.security import create_access_token
from tests.conftest import bearer, register


async def test_register_returns_token_and_user(client: AsyncClient) -> None:
    body = await register(client)
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["username"] == "alice"
    assert body["user"]["email"] == "alice@cryptoarena.dev"
    assert "password" not in body["user"]


async def test_register_rejects_weak_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@cryptoarena.dev", "password": "weakweak", "password_confirm": "weakweak"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert "majuscule" in body["detail"]


async def test_register_rejects_mismatched_confirmation(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@cryptoarena.dev", "password": "Secret123", "password_confirm": "Secret124"},
    )
    assert response.status_code == 422
    assert "correspondent pas" in response.json()["detail"]


async def test_register_rejects_duplicate_email(client: AsyncClient) -> None:
    await register(client)
    response = await client.post(
        "/api/auth/register",
        json={"username": "alice2", "email": "ALICE@cryptoarena.dev", "password": "Secret123", "password_confirm": "Secret123"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_TAKEN"


async def test_login_then_me(client: AsyncClient) -> None:
    await register(client)
    response = await client.post("/api/auth/login", json={"email": "alice@cryptoarena.dev", "password": "Secret123"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = await client.get("/api/auth/me", headers=bearer(token))
    assert me.status_code == 200
    assert me.json()["username"] == "alice"


async def test_login_wrong_password(client: AsyncClient) -> None:
    await register(client)
    response = await client.post("/api/auth/login", json={"email": "alice@cryptoarena.dev", "password": "Wrong1234"})
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_protected_route_requires_token(client: AsyncClient) -> None:
    response = await client.get("/api/portfolio")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


async def test_expired_token_is_rejected(client: AsyncClient) -> None:
    body = await register(client)
    expired = create_access_token(body["user"]["id"], expires_minutes=-1)
    response = await client.get("/api/auth/me", headers=bearer(expired))
    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_EXPIRED"
