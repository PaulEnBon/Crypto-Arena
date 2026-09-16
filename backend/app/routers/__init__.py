"""HTTP routers, mounted under /api by app.main."""

from fastapi import APIRouter

from app.routers import auth, crypto, health, leaderboard, portfolio, profile, trades

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(crypto.router)
api_router.include_router(portfolio.router)
api_router.include_router(trades.router)
api_router.include_router(leaderboard.router)
api_router.include_router(profile.router)
