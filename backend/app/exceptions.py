"""Domain exceptions mapped to HTTP responses by the handlers in app.middleware.error_handlers."""


class AppError(Exception):
    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, detail: str, *, status_code: int | None = None, code: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


# --- Authentication ---
class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class InvalidCredentialsError(UnauthorizedError):
    code = "INVALID_CREDENTIALS"


class TokenExpiredError(UnauthorizedError):
    code = "TOKEN_EXPIRED"


class InvalidTokenError(UnauthorizedError):
    code = "INVALID_TOKEN"


class EmailNotVerifiedError(AppError):
    status_code = 403
    code = "EMAIL_NOT_VERIFIED"


class OAuthDisabledError(AppError):
    status_code = 503
    code = "OAUTH_DISABLED"


class OAuthUnavailableError(AppError):
    status_code = 503
    code = "OAUTH_UNAVAILABLE"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


# --- Trading ---
class InvalidQuantityError(AppError):
    code = "INVALID_QUANTITY"


class InsufficientFundsError(AppError):
    code = "INSUFFICIENT_FUNDS"


class InsufficientHoldingsError(AppError):
    code = "INSUFFICIENT_HOLDINGS"


class InvalidPriceError(AppError):
    status_code = 502
    code = "INVALID_PRICE"


# --- CoinGecko ---
class CoinGeckoError(AppError):
    status_code = 502
    code = "COINGECKO_ERROR"


class CoinGeckoRateLimitError(CoinGeckoError):
    status_code = 429
    code = "COINGECKO_RATE_LIMIT"


class CoinGeckoUnavailableError(CoinGeckoError):
    status_code = 503
    code = "COINGECKO_UNAVAILABLE"


class CoinNotFoundError(NotFoundError):
    code = "COIN_NOT_FOUND"
