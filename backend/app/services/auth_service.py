"""Registration, login and token issuance."""

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, hash_password, verify_password
from app.config import get_settings
from app.exceptions import ConflictError, InvalidCredentialsError
from app.models import Portfolio, User
from app.schemas.auth import RegisterRequest, TokenResponse
from app.schemas.user import UserPublic


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    settings = get_settings()
    email = data.email.lower()

    email_taken = await db.scalar(select(User.id).where(func.lower(User.email) == email))
    if email_taken is not None:
        raise ConflictError("Cet email est déjà utilisé.", code="EMAIL_TAKEN")
    username_taken = await db.scalar(select(User.id).where(func.lower(User.username) == data.username.lower()))
    if username_taken is not None:
        raise ConflictError("Ce nom d'utilisateur est déjà pris.", code="USERNAME_TAKEN")

    # bcrypt is intentionally slow (~250 ms): run it in a worker thread to keep the event loop free.
    password_hash = await asyncio.to_thread(hash_password, data.password)
    user = User(username=data.username, email=email, password_hash=password_hash)
    user.portfolio = Portfolio(cash_balance=settings.INITIAL_BALANCE, initial_balance=settings.INITIAL_BALANCE)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    # Constant behaviour whether the email exists or not: same error, no user enumeration.
    valid = user is not None and await asyncio.to_thread(verify_password, password, user.password_hash)
    if user is None or not valid:
        raise InvalidCredentialsError("Email ou mot de passe incorrect.")
    return user


def build_token_response(user: User) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic.model_validate(user),
    )
