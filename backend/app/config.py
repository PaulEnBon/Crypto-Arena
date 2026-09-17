"""Typed application settings loaded from environment variables / backend/.env."""

from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "Crypto Arena API"
    APP_ENV: Literal["development", "test", "production"] = "development"
    DEBUG: bool = False
    AUTO_INIT_DB: bool = True

    # --- Database ---
    DATABASE_URL: str

    # --- Authentication ---
    JWT_SECRET: str = Field(min_length=16)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    BCRYPT_ROUNDS: int = 12

    # --- CoinGecko ---
    COINGECKO_API_KEY: str = ""
    COINGECKO_BASE_URL: str = "https://api.coingecko.com/api/v3"
    COINGECKO_TIMEOUT_SECONDS: float = 10.0
    COINGECKO_MAX_RETRIES: int = 2
    COINGECKO_MAX_CONCURRENCY: int = 4
    COINGECKO_CACHE_TTL_MARKETS: int = 60
    COINGECKO_CACHE_TTL_PRICES: int = 30
    COINGECKO_CACHE_TTL_COIN: int = 120
    COINGECKO_CACHE_TTL_HISTORY: int = 300
    COINGECKO_CACHE_TTL_SEARCH: int = 600
    COINGECKO_CACHE_TTL_TRENDING: int = 300

    # --- Neon Auth : connexion Google / GitHub (vide = désactivée) ---
    NEON_AUTH_URL: str = ""
    NEON_AUTH_JWKS_TTL_SECONDS: int = 3600
    NEON_AUTH_CLOCK_LEEWAY_SECONDS: int = 30

    # --- Game rules ---
    INITIAL_BALANCE: Decimal = Decimal("10000")
    SNAPSHOT_INTERVAL_MINUTES: int = 60
    LEADERBOARD_CACHE_TTL: int = 30

    # --- CORS (comma separated list of allowed origins) ---
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Normalise hosted-provider URLs to the async psycopg driver."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
