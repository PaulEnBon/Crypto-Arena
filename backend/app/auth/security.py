"""Password hashing (bcrypt) and JWT access tokens (PyJWT)."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings
from app.exceptions import InvalidTokenError, TokenExpiredError

# bcrypt silently ignores (or, since bcrypt 5, rejects) bytes beyond 72; we enforce the limit in the schemas too.
BCRYPT_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    settings = get_settings()
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash or password longer than 72 bytes: treat as a failed check, never crash.
        return False


def create_access_token(user_id: int, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    lifetime = timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "iat": now, "exp": now + lifetime, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Return the user id carried by a valid token, or raise a 401 domain error."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError("Votre session a expiré, veuillez vous reconnecter.") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError("Jeton d'authentification invalide.") from exc

    subject = payload.get("sub")
    if payload.get("type") != "access" or not isinstance(subject, str) or not subject.isdigit():
        raise InvalidTokenError("Jeton d'authentification invalide.")
    return int(subject)
