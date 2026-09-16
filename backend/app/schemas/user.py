from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

USERNAME_PATTERN = r"^[A-Za-z0-9_]{3,20}$"
USERNAME_DESCRIPTION = "3 à 20 caractères : lettres, chiffres et underscore."


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    created_at: datetime
    is_demo: bool = False


class UpdateProfileRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=USERNAME_PATTERN, description=USERNAME_DESCRIPTION)


class ProfileResponse(BaseModel):
    user: UserPublic
    initial_balance: float
    cash_balance: float
    portfolio_value: float
    profit_loss: float
    performance_pct: float
    transactions_count: int
    rank: int | None
    total_players: int
