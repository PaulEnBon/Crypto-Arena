"""Registration, login (email + password or Google / GitHub via Neon Auth) and token issuance."""

import asyncio
import re
import secrets
import unicodedata

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, hash_password, make_unusable_password, verify_password
from app.config import get_settings
from app.exceptions import ConflictError, EmailNotVerifiedError, InvalidCredentialsError
from app.models import Portfolio, User
from app.schemas.auth import RegisterRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.leaderboard_service import invalidate_ranking_cache
from app.services.neon_auth_service import NeonIdentity

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 20
USERNAME_FALLBACK = "joueur"
MAX_CREATE_ATTEMPTS = 3


def new_portfolio() -> Portfolio:
    settings = get_settings()
    return Portfolio(cash_balance=settings.INITIAL_BALANCE, initial_balance=settings.INITIAL_BALANCE)


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
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
    user.portfolio = new_portfolio()
    db.add(user)
    await db.commit()
    await db.refresh(user)
    invalidate_ranking_cache()
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    # Constant behaviour whether the email exists or not: same error, no user enumeration.
    valid = user is not None and await asyncio.to_thread(verify_password, password, user.password_hash)
    if user is None or not valid:
        raise InvalidCredentialsError("Email ou mot de passe incorrect.")
    return user


# ---------------------------------------------------------------- Google / GitHub (Neon Auth)


def username_base(name: str | None, email: str) -> str:
    """Turn "Adèle Martin" or "adele.martin@gmail.com" into a valid username such as "Adele_Martin"."""
    raw = name or email.split("@", 1)[0]
    ascii_text = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", ascii_text).strip("_")
    cleaned = cleaned[:USERNAME_MAX_LENGTH].rstrip("_")
    if len(cleaned) < USERNAME_MIN_LENGTH:
        return USERNAME_FALLBACK
    return cleaned


async def find_available_username(db: AsyncSession, base: str) -> str:
    candidates = [base] + [f"{base[: USERNAME_MAX_LENGTH - len(str(n)) - 1]}_{n}" for n in range(2, 100)]
    for candidate in candidates:
        taken = await db.scalar(select(User.id).where(func.lower(User.username) == candidate.lower()))
        if taken is None:
            return candidate
    return f"{USERNAME_FALLBACK}_{secrets.token_hex(4)}"


async def sign_in_with_neon_identity(db: AsyncSession, identity: NeonIdentity) -> User:
    """Return the player behind a verified Neon Auth identity, linking or creating the account.

    1. already linked (same Neon Auth id): sign in;
    2. same email as an existing account: link it, which is safe because the provider verified the email;
    3. otherwise: create a player with the usual starting portfolio and no usable password.
    """
    if not identity.email_verified:
        raise EmailNotVerifiedError("Votre adresse email n'est pas vérifiée auprès de Google ou GitHub.")

    user = await db.scalar(select(User).where(User.neon_auth_id == identity.subject))
    if user is not None:
        return user

    user = await db.scalar(select(User).where(func.lower(User.email) == identity.email))
    if user is not None:
        if user.neon_auth_id is None:
            user.neon_auth_id = identity.subject
            await db.commit()
        return user

    return await create_oauth_user(db, identity)


async def create_oauth_user(db: AsyncSession, identity: NeonIdentity) -> User:
    base = username_base(identity.name, identity.email)
    for _ in range(MAX_CREATE_ATTEMPTS):
        user = User(
            username=await find_available_username(db, base),
            email=identity.email,
            password_hash=make_unusable_password(),
            neon_auth_id=identity.subject,
        )
        user.portfolio = new_portfolio()
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Two callbacks for the same person can race (double click, two tabs): reuse the winner.
            existing = await db.scalar(
                select(User).where(or_(User.neon_auth_id == identity.subject, func.lower(User.email) == identity.email))
            )
            if existing is not None:
                return existing
            continue  # the username was taken meanwhile: pick another one
        await db.refresh(user)
        invalidate_ranking_cache()
        return user
    raise ConflictError("Impossible de créer le compte pour le moment, réessayez.", code="USERNAME_TAKEN")


def build_token_response(user: User) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic.model_validate(user),
    )
