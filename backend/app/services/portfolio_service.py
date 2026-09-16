"""Portfolio valuation, transaction history and performance snapshots.

All money maths is done with Decimal; floats only appear in the response schemas.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import CoinGeckoError, NotFoundError
from app.models import Asset, Holding, Portfolio, PortfolioSnapshot, Transaction, User
from app.schemas.common import Paginated
from app.schemas.portfolio import (
    PortfolioAsset,
    PortfolioSummary,
    SnapshotOut,
    SnapshotsResponse,
    TransactionOut,
)
from app.services.coingecko_service import CoinGeckoService

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")


def money(value: Decimal) -> float:
    return float(value.quantize(CENT, rounding=ROUND_HALF_UP))


def pct(numerator: Decimal, denominator: Decimal) -> float:
    if denominator == 0:
        return 0.0
    return float((numerator / denominator * 100).quantize(CENT, rounding=ROUND_HALF_UP))


def ensure_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC so comparisons never crash."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def quote_price(quote: dict[str, Any] | None) -> Decimal | None:
    if not quote:
        return None
    raw = quote.get("eur")
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or raw <= 0:
        return None
    return Decimal(str(raw))


# ---------------------------------------------------------------- queries


async def get_portfolio(db: AsyncSession, user_id: int, *, for_update: bool = False) -> Portfolio:
    stmt = select(Portfolio).where(Portfolio.user_id == user_id)
    if for_update:
        # Row lock for the duration of the trade; populate_existing refreshes any value loaded earlier.
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    portfolio = await db.scalar(stmt)
    if portfolio is None:
        raise NotFoundError("Portefeuille introuvable.")
    return portfolio


async def get_active_holdings(db: AsyncSession, portfolio_id: int) -> list[Holding]:
    stmt = (
        select(Holding)
        .join(Asset, Asset.id == Holding.asset_id)
        .where(Holding.portfolio_id == portfolio_id, Holding.quantity > 0)
        .order_by(Asset.name)
    )
    return list((await db.scalars(stmt)).all())


async def fetch_prices(coingecko: CoinGeckoService, coin_ids: list[str]) -> tuple[dict[str, dict[str, Any]], bool]:
    """Return (quotes, live). When CoinGecko is down and nothing is cached, valuation degrades gracefully."""
    if not coin_ids:
        return {}, True
    try:
        return await coingecko.get_simple_prices(coin_ids), True
    except CoinGeckoError as exc:
        logger.warning("Prices unavailable (%s): falling back to average buy prices", exc.code)
        return {}, False


# ---------------------------------------------------------------- valuation (pure)


def value_portfolio(
    portfolio: Portfolio,
    holdings: list[Holding],
    quotes: dict[str, dict[str, Any]],
) -> PortfolioSummary:
    holdings_value = Decimal("0")
    invested_total = Decimal("0")
    valued: list[tuple[Holding, Decimal, Decimal, Decimal, str, float | None]] = []

    for holding in holdings:
        quote = quotes.get(holding.asset.coingecko_id)
        live_price = quote_price(quote)
        price = live_price if live_price is not None else holding.avg_buy_price
        source = "live" if live_price is not None else "fallback"
        change = quote.get("eur_24h_change") if quote and live_price is not None else None
        value = holding.quantity * price
        invested = holding.quantity * holding.avg_buy_price
        holdings_value += value
        invested_total += invested
        valued.append((holding, price, value, invested, source, change if isinstance(change, (int, float)) else None))

    total_value = portfolio.cash_balance + holdings_value
    profit_loss = total_value - portfolio.initial_balance

    assets = [
        PortfolioAsset(
            asset_id=holding.asset.id,
            coin_id=holding.asset.coingecko_id,
            symbol=holding.asset.symbol,
            name=holding.asset.name,
            image_url=holding.asset.image_url,
            quantity=float(holding.quantity),
            avg_buy_price=float(holding.avg_buy_price),
            current_price=float(price),
            price_change_24h=change,
            price_source="live" if source == "live" else "fallback",
            value=money(value),
            invested=money(invested),
            profit_loss=money(value - invested),
            profit_loss_pct=pct(value - invested, invested),
            allocation_pct=pct(value, total_value),
        )
        for holding, price, value, invested, source, change in valued
    ]
    assets.sort(key=lambda asset: asset.value, reverse=True)

    return PortfolioSummary(
        cash_balance=money(portfolio.cash_balance),
        initial_balance=money(portfolio.initial_balance),
        invested_amount=money(invested_total),
        holdings_value=money(holdings_value),
        total_value=money(total_value),
        profit_loss=money(profit_loss),
        performance_pct=pct(profit_loss, portfolio.initial_balance),
        assets=assets,
        updated_at=datetime.now(timezone.utc),
    )


async def build_portfolio_summary(db: AsyncSession, user: User, coingecko: CoinGeckoService) -> PortfolioSummary:
    portfolio = await get_portfolio(db, user.id)
    holdings = await get_active_holdings(db, portfolio.id)
    quotes, _ = await fetch_prices(coingecko, [holding.asset.coingecko_id for holding in holdings])
    return value_portfolio(portfolio, holdings, quotes)


# ---------------------------------------------------------------- snapshots


async def record_snapshot(db: AsyncSession, user_id: int, summary: PortfolioSummary, *, force: bool = False) -> bool:
    """Persist a valuation point. Unless forced, at most one snapshot per SNAPSHOT_INTERVAL_MINUTES."""
    settings = get_settings()
    if not force:
        last = await db.scalar(
            select(func.max(PortfolioSnapshot.created_at)).where(PortfolioSnapshot.user_id == user_id)
        )
        if last is not None:
            age = datetime.now(timezone.utc) - ensure_utc(last)
            if age < timedelta(minutes=settings.SNAPSHOT_INTERVAL_MINUTES):
                return False
    db.add(
        PortfolioSnapshot(
            user_id=user_id,
            total_value=Decimal(str(summary.total_value)),
            profit_loss=Decimal(str(summary.profit_loss)),
        )
    )
    await db.commit()
    return True


async def list_snapshots(db: AsyncSession, user_id: int, days: int) -> SnapshotsResponse:
    portfolio = await get_portfolio(db, user_id)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.user_id == user_id, PortfolioSnapshot.created_at >= since)
        .order_by(PortfolioSnapshot.created_at)
    )
    snapshots = (await db.scalars(stmt)).all()
    points = [
        SnapshotOut(total_value=float(s.total_value), profit_loss=float(s.profit_loss), created_at=ensure_utc(s.created_at))
        for s in snapshots
    ]
    return SnapshotsResponse(days=days, initial_balance=float(portfolio.initial_balance), points=points)


# ---------------------------------------------------------------- transactions


def to_transaction_out(transaction: Transaction, asset: Asset) -> TransactionOut:
    return TransactionOut(
        id=transaction.id,
        coin_id=asset.coingecko_id,
        symbol=asset.symbol,
        name=asset.name,
        image_url=asset.image_url,
        type="BUY" if transaction.type == "BUY" else "SELL",
        quantity=float(transaction.quantity),
        price=float(transaction.price),
        total=float(transaction.total),
        created_at=ensure_utc(transaction.created_at),
    )


async def count_transactions(db: AsyncSession, user_id: int) -> int:
    total = await db.scalar(select(func.count(Transaction.id)).where(Transaction.user_id == user_id))
    return int(total or 0)


async def list_transactions(db: AsyncSession, user_id: int, page: int, page_size: int) -> Paginated[TransactionOut]:
    total = await count_transactions(db, user_id)
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    transactions = (await db.scalars(stmt)).all()
    items = [to_transaction_out(tx, tx.asset) for tx in transactions]
    return Paginated[TransactionOut].build(items=items, page=page, page_size=page_size, total=total)
