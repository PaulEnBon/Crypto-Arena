"""Verification of the JWTs issued by Neon Auth (managed Better Auth) after a Google or GitHub sign-in.

The browser never sends a Google or GitHub token to this API. Once the OAuth redirect is
over, Neon Auth hands the frontend a short-lived JWT signed with Ed25519. This service
checks that token against Neon's public keys (JWKS) before the backend issues its own
session token, so the rest of the application keeps a single authentication mechanism.

Checks performed: EdDSA signature with a key from the JWKS, `exp` / `iat` with a small
clock leeway, issuer and audience bound to our Neon Auth URL, and rejection of the
anonymous tokens that Neon Auth hands out without any sign-in.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
import jwt

from app.config import Settings
from app.exceptions import InvalidTokenError, OAuthDisabledError, OAuthUnavailableError, TokenExpiredError

logger = logging.getLogger(__name__)

ALGORITHM = "EdDSA"
MAX_SUBJECT_LENGTH = 64
MIN_UNKNOWN_KID_REFRESH_SECONDS = 60
INVALID_TOKEN_MESSAGE = "Connexion Google ou GitHub invalide, veuillez recommencer."


@dataclass(frozen=True, slots=True)
class NeonIdentity:
    subject: str
    email: str
    name: str | None
    email_verified: bool


class NeonAuthVerifier:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._base_url = settings.NEON_AUTH_URL.strip().rstrip("/")
        parts = urlsplit(self._base_url)
        self._origin = f"{parts.scheme}://{parts.netloc}" if parts.scheme == "https" and parts.netloc else ""
        self._jwks_url = f"{self._base_url}/.well-known/jwks.json"
        self._jwks_ttl = settings.NEON_AUTH_JWKS_TTL_SECONDS
        self._leeway = settings.NEON_AUTH_CLOCK_LEEWAY_SECONDS
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(10.0))
        self._owns_client = client is None
        self._keys: dict[str, jwt.PyJWK] = {}
        self._keys_fetched_at = 0.0
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self._origin)

    async def verify(self, token: str) -> NeonIdentity:
        if not self.enabled:
            raise OAuthDisabledError("La connexion avec Google ou GitHub n'est pas activée sur ce serveur.")
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError(INVALID_TOKEN_MESSAGE) from exc
        kid = header.get("kid")
        if header.get("alg") != ALGORITHM or not isinstance(kid, str) or not kid:
            raise InvalidTokenError(INVALID_TOKEN_MESSAGE)

        key = await self._get_key(kid)
        try:
            # Neon puts the full Auth URL in `iss` and its origin in `aud`; both values are
            # accepted for each claim because they identify the same Neon Auth instance.
            claims: dict[str, Any] = jwt.decode(
                token,
                key.key,
                algorithms=[ALGORITHM],
                issuer=[self._base_url, self._origin],
                audience=[self._base_url, self._origin],
                leeway=self._leeway,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise TokenExpiredError("La connexion Google ou GitHub a expiré, veuillez recommencer.") from exc
        except jwt.PyJWTError as exc:
            raise InvalidTokenError(INVALID_TOKEN_MESSAGE) from exc
        return self._to_identity(claims)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------ internals

    @staticmethod
    def _to_identity(claims: dict[str, Any]) -> NeonIdentity:
        subject = claims.get("sub")
        if claims.get("role") == "anonymous" or subject == "anonymous":
            raise InvalidTokenError("Un jeton anonyme ne permet pas de se connecter.")
        if not isinstance(subject, str) or not subject or len(subject) > MAX_SUBJECT_LENGTH:
            raise InvalidTokenError(INVALID_TOKEN_MESSAGE)
        email = claims.get("email")
        if not isinstance(email, str) or "@" not in email:
            raise InvalidTokenError("Le fournisseur n'a pas transmis d'adresse email.")
        name = claims.get("name")
        return NeonIdentity(
            subject=subject,
            email=email.strip().lower(),
            name=name.strip() if isinstance(name, str) and name.strip() else None,
            email_verified=claims.get("emailVerified") is True,
        )

    def _keys_expired(self) -> bool:
        return time.monotonic() - self._keys_fetched_at > self._jwks_ttl

    async def _get_key(self, kid: str) -> jwt.PyJWK:
        key = None if self._keys_expired() else self._keys.get(kid)
        if key is not None:
            return key
        async with self._lock:
            recently_fetched = time.monotonic() - self._keys_fetched_at < MIN_UNKNOWN_KID_REFRESH_SECONDS
            # An unknown `kid` triggers at most one JWKS download per minute (key rotation vs abuse).
            if self._keys_expired() or (kid not in self._keys and not recently_fetched):
                await self._refresh_keys()
        key = self._keys.get(kid)
        if key is None:
            raise InvalidTokenError(INVALID_TOKEN_MESSAGE)
        return key

    async def _refresh_keys(self) -> None:
        try:
            response = await self._client.get(self._jwks_url)
            response.raise_for_status()
            jwk_set = jwt.PyJWKSet.from_dict(response.json())
        except (httpx.HTTPError, ValueError, jwt.PyJWTError) as exc:
            if self._keys:
                logger.warning("Neon Auth JWKS refresh failed, keeping previous keys: %s", exc)
                # Serve the previous keys, and try again in a minute rather than after a full TTL.
                self._keys_fetched_at = time.monotonic() - self._jwks_ttl + MIN_UNKNOWN_KID_REFRESH_SECONDS
                return
            raise OAuthUnavailableError("Neon Auth est momentanément injoignable, réessayez.") from exc
        self._keys = {key.key_id: key for key in jwk_set.keys if key.key_id}
        self._keys_fetched_at = time.monotonic()
