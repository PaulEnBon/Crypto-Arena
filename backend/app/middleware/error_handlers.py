"""Uniform JSON error responses: every error carries `detail` (human message) and `code` (machine code)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import AppError

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail, "code": exc.code}, headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in error["loc"] if part not in ("body", "query", "path")),
                "message": error["msg"],
            }
            for error in exc.errors()
        ]
        first = errors[0]["message"] if errors else "Données invalides."
        return JSONResponse(
            status_code=422,
            content={"detail": first, "code": "VALIDATION_ERROR", "errors": errors},
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Erreur HTTP."
        if exc.status_code == 404:
            detail = "Ressource introuvable."
        return JSONResponse(
            status_code=exc.status_code, content={"detail": detail, "code": "HTTP_ERROR"}, headers=exc.headers
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Erreur base de données, réessayez plus tard.", "code": "DATABASE_ERROR"},
        )
