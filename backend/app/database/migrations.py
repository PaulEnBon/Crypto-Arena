"""Idempotent schema upgrades for databases created before a model change.

`Base.metadata.create_all` creates missing tables but never alters existing ones, so a
column added to a model after the first deployment is applied here. Every statement uses
IF NOT EXISTS: running them on an up-to-date database changes nothing.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

POSTGRES_UPGRADES: tuple[str, ...] = (
    # 2026-09 : connexion Google / GitHub via Neon Auth
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS neon_auth_id VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_neon_auth_id ON users (neon_auth_id)",
)


async def apply_schema_upgrades(connection: AsyncConnection) -> None:
    if connection.dialect.name != "postgresql":
        return  # SQLite is only used by the test-suite, which always starts from the current models
    for statement in POSTGRES_UPGRADES:
        await connection.execute(text(statement))
