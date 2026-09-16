from fastapi import APIRouter, status

from app.auth.dependencies import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.auth_service import authenticate_user, build_token_response, register_user

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


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    """Return the user carried by the Bearer token (used by the frontend on start-up)."""
    return UserPublic.model_validate(user)
