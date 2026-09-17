"""FastAPI dependencies resolving the authenticated user from the Bearer token."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_access_token
from app.database.session import get_db
from app.exceptions import UnauthorizedError
from app.models import User
from app.services.coingecko_service import CoinGeckoService
from app.services.neon_auth_service import NeonAuthVerifier

bearer_scheme = HTTPBearer(auto_error=False, description="JWT obtenu via /api/auth/login")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Authentification requise.")

    user_id = decode_access_token(credentials.credentials)
    user = await db.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Utilisateur introuvable.", code="INVALID_TOKEN")
    return user


def get_coingecko(request: Request) -> CoinGeckoService:
    """The single CoinGeckoService instance is created in the app lifespan (see main.py)."""
    service: CoinGeckoService = request.app.state.coingecko
    return service


def get_neon_auth(request: Request) -> NeonAuthVerifier:
    """Single NeonAuthVerifier (and its JWKS cache) created in the app lifespan."""
    verifier: NeonAuthVerifier = request.app.state.neon_auth
    return verifier


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
CoinGecko = Annotated[CoinGeckoService, Depends(get_coingecko)]
NeonAuth = Annotated[NeonAuthVerifier, Depends(get_neon_auth)]
