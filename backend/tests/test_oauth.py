"""Google / GitHub sign-in through Neon Auth: JWT verification and account linking.

Tokens are signed with a real Ed25519 key generated for the test, and the JWKS endpoint is
served by a mocked HTTP transport, so the verification path is the one used in production.
"""

import time
import uuid
from collections.abc import Callable
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from httpx import AsyncClient
from jwt.algorithms import OKPAlgorithm

from app.auth.dependencies import get_neon_auth
from app.config import Settings
from app.main import app
from app.services.auth_service import username_base
from app.services.neon_auth_service import NeonAuthVerifier
from tests.conftest import bearer, register

NEON_AUTH_URL = "https://ep-test-123.neonauth.eu-central-1.aws.neon.tech/neondb/auth"
NEON_ORIGIN = "https://ep-test-123.neonauth.eu-central-1.aws.neon.tech"
KID = "test-key-1"

TokenFactory = Callable[..., str]


def make_settings(url: str = NEON_AUTH_URL) -> Settings:
    return Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        JWT_SECRET="unit-test-secret-key-not-for-production-0123456789",
        NEON_AUTH_URL=url,
    )


@pytest.fixture
def signing_key() -> Ed25519PrivateKey:
    return Ed25519PrivateKey.generate()


@pytest.fixture
def jwks_requests() -> list[httpx.Request]:
    return []


@pytest.fixture
def verifier(signing_key: Ed25519PrivateKey, jwks_requests: list[httpx.Request]) -> NeonAuthVerifier:
    public_jwk: dict[str, Any] = OKPAlgorithm.to_jwk(signing_key.public_key(), as_dict=True)
    public_jwk.update({"kid": KID, "alg": "EdDSA"})

    def handler(request: httpx.Request) -> httpx.Response:
        jwks_requests.append(request)
        assert str(request.url) == f"{NEON_AUTH_URL}/.well-known/jwks.json"
        return httpx.Response(200, json={"keys": [public_jwk]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return NeonAuthVerifier(make_settings(), client=client)


@pytest.fixture
def make_token(signing_key: Ed25519PrivateKey) -> TokenFactory:
    def factory(key: Ed25519PrivateKey | None = None, kid: str = KID, **overrides: Any) -> str:
        now = int(time.time())
        claims: dict[str, Any] = {
            "sub": "0b7e7a52-1d7f-4a8e-9a39-3f5c6d0e2a11",
            "email": "ada.lovelace@gmail.com",
            "name": "Ada Lovelace",
            "emailVerified": True,
            "iat": now,
            "exp": now + 900,
            "iss": NEON_AUTH_URL,
            "aud": NEON_ORIGIN,
        }
        claims.update(overrides)
        claims = {name: value for name, value in claims.items() if value is not None}
        return jwt.encode(claims, key or signing_key, algorithm="EdDSA", headers={"kid": kid})

    return factory


@pytest.fixture
def oauth_client(client: AsyncClient, verifier: NeonAuthVerifier) -> AsyncClient:
    app.dependency_overrides[get_neon_auth] = lambda: verifier
    return client  # overrides are cleared by the `client` fixture teardown


async def oauth_sign_in(client: AsyncClient, token: str) -> httpx.Response:
    return await client.post("/api/auth/oauth", json={"token": token})


# ---------------------------------------------------------------- account creation and linking


async def test_first_sign_in_creates_a_player_with_a_portfolio(
    oauth_client: AsyncClient, make_token: TokenFactory
) -> None:
    response = await oauth_sign_in(oauth_client, make_token())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["username"] == "Ada_Lovelace"
    assert body["user"]["email"] == "ada.lovelace@gmail.com"

    portfolio = await oauth_client.get("/api/portfolio", headers=bearer(body["access_token"]))
    assert portfolio.status_code == 200
    assert portfolio.json()["cash_balance"] == 10000.0


async def test_signing_in_again_returns_the_same_player(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    first = await oauth_sign_in(oauth_client, make_token())
    second = await oauth_sign_in(oauth_client, make_token(name="Another Display Name"))
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert second.json()["user"]["username"] == "Ada_Lovelace"


async def test_verified_email_links_an_existing_password_account(
    oauth_client: AsyncClient, make_token: TokenFactory
) -> None:
    existing = await register(oauth_client, "ada", "ada.lovelace@gmail.com", "Secret123")
    response = await oauth_sign_in(oauth_client, make_token(email="Ada.Lovelace@gmail.com"))
    assert response.status_code == 200
    assert response.json()["user"]["id"] == existing["user"]["id"]

    password_login = await oauth_client.post(
        "/api/auth/login", json={"email": "ada.lovelace@gmail.com", "password": "Secret123"}
    )
    assert password_login.status_code == 200  # linking keeps the password working


async def test_oauth_only_account_cannot_log_in_with_a_password(
    oauth_client: AsyncClient, make_token: TokenFactory
) -> None:
    await oauth_sign_in(oauth_client, make_token())
    response = await oauth_client.post(
        "/api/auth/login", json={"email": "ada.lovelace@gmail.com", "password": "Whatever123"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_username_collision_gets_a_suffix(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    await register(oauth_client, "Ada_Lovelace", "someone.else@cryptoarena.dev", "Secret123")
    response = await oauth_sign_in(oauth_client, make_token())
    assert response.json()["user"]["username"] == "Ada_Lovelace_2"


@pytest.mark.parametrize(
    ("name", "email", "expected"),
    [
        ("Adèle Martin-Dupont", "a@x.io", "Adele_Martin_Dupont"),
        (None, "jean.pierre+test@gmail.com", "jean_pierre_test"),
        ("A very very long display name indeed", "a@x.io", "A_very_very_long_dis"),
        ("李", "x@x.io", "joueur"),
    ],
)
def test_username_base(name: str | None, email: str, expected: str) -> None:
    assert username_base(name, email) == expected


# ---------------------------------------------------------------- rejected tokens


async def test_unverified_email_is_rejected(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    response = await oauth_sign_in(oauth_client, make_token(emailVerified=False))
    assert response.status_code == 403
    assert response.json()["code"] == "EMAIL_NOT_VERIFIED"


async def test_anonymous_token_is_rejected(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    token = make_token(sub="anonymous", role="anonymous", email=None, name=None, emailVerified=None)
    response = await oauth_sign_in(oauth_client, token)
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_TOKEN"


async def test_token_signed_with_another_key_is_rejected(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    forged = make_token(key=Ed25519PrivateKey.generate())
    response = await oauth_sign_in(oauth_client, forged)
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_TOKEN"


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "https://evil.example.com/neondb/auth"},
        {"aud": "https://evil.example.com"},
        {"sub": None},
    ],
)
async def test_invalid_claims_are_rejected(
    oauth_client: AsyncClient, make_token: TokenFactory, overrides: dict[str, Any]
) -> None:
    response = await oauth_sign_in(oauth_client, make_token(**overrides))
    assert response.status_code == 401


async def test_expired_token_is_rejected(oauth_client: AsyncClient, make_token: TokenFactory) -> None:
    now = int(time.time())
    response = await oauth_sign_in(oauth_client, make_token(iat=now - 3600, exp=now - 1800))
    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_EXPIRED"


async def test_non_eddsa_token_is_rejected(oauth_client: AsyncClient) -> None:
    now = int(time.time())
    hs256 = jwt.encode(
        {"sub": str(uuid.uuid4()), "email": "a@b.io", "emailVerified": True, "iat": now, "exp": now + 60,
         "iss": NEON_AUTH_URL, "aud": NEON_ORIGIN},
        "a-shared-secret-that-is-long-enough-0123456789",
        algorithm="HS256",
        headers={"kid": KID},
    )
    response = await oauth_sign_in(oauth_client, hs256)
    assert response.status_code == 401


async def test_unknown_key_id_is_rejected_without_hammering_the_jwks(
    oauth_client: AsyncClient, make_token: TokenFactory, jwks_requests: list[httpx.Request]
) -> None:
    assert (await oauth_sign_in(oauth_client, make_token())).status_code == 200
    for _ in range(3):
        response = await oauth_sign_in(oauth_client, make_token(kid="unknown-kid"))
        assert response.status_code == 401
    assert len(jwks_requests) == 1  # keys are cached; unknown kids refetch at most once a minute


async def test_disabled_when_neon_auth_url_is_missing(client: AsyncClient, make_token: TokenFactory) -> None:
    disabled = NeonAuthVerifier(make_settings(url=""))
    app.dependency_overrides[get_neon_auth] = lambda: disabled
    response = await oauth_sign_in(client, make_token())
    assert response.status_code == 503
    assert response.json()["code"] == "OAUTH_DISABLED"
    await disabled.aclose()
