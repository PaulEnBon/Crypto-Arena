from fastapi import APIRouter, status

from app.auth.dependencies import CurrentUser, DbSession, NeonAuth
from app.schemas.auth import LoginRequest, OAuthExchangeRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.auth_service import (
    authenticate_user,
    build_token_response,
    register_user,
    sign_in_with_neon_identity,
)

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: DbSession) -> TokenResponse:
    """Create an account with a 10 000 € virtual portfolio and return a JWT."""
    user = await register_user(db, data)
    return build_token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: DbSession) -> TokenResponse:
    user = await authenticate_user(db, data.email, data.password)
    return build_token_response(user)


@router.post(
    "/oauth",
    response_model=TokenResponse,
    responses={
        401: {"description": "Jeton Neon Auth invalide, expiré ou anonyme"},
        403: {"description": "Email non vérifié par Google ou GitHub"},
        503: {"description": "Connexion Google / GitHub désactivée ou Neon Auth injoignable"},
    },
)
async def oauth_sign_in(data: OAuthExchangeRequest, db: DbSession, neon_auth: NeonAuth) -> TokenResponse:
    """Exchange the JWT issued by Neon Auth after a Google / GitHub sign-in for a Crypto Arena JWT.

    The account is found by its Neon Auth id, linked by verified email, or created with 10 000 €.
    """
    identity = await neon_auth.verify(data.token)
    user = await sign_in_with_neon_identity(db, identity)
    return build_token_response(user)


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    """Return the user carried by the Bearer token (used by the frontend on start-up)."""
    return UserPublic.model_validate(user)
