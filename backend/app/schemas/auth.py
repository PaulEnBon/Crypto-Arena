import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.user import USERNAME_DESCRIPTION, USERNAME_PATTERN, UserPublic

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 64  # stays under bcrypt's 72-byte limit even with multi-byte characters


def validate_password_strength(password: str) -> str:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Le mot de passe doit contenir au moins {PASSWORD_MIN_LENGTH} caractères.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Le mot de passe doit contenir au moins une minuscule.")
    if not re.search(r"\d", password):
        raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
    return password


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=USERNAME_PATTERN, description=USERNAME_DESCRIPTION)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    password_confirm: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def _check_confirmation(self) -> "RegisterRequest":
        if self.password != self.password_confirm:
            raise ValueError("Les mots de passe ne correspondent pas.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class OAuthExchangeRequest(BaseModel):
    """JWT delivered by Neon Auth to the browser after a Google or GitHub sign-in."""

    token: str = Field(min_length=20, max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserPublic
