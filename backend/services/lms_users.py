"""JFT Basic LMS user lookup — reads directly from LMS MySQL DB."""

from __future__ import annotations

import asyncio
import logging
import os

import aiomysql

logger = logging.getLogger(__name__)

LMS_DB = {
    "host": os.environ.get("DB_LMS_HOST", "10.100.101.18"),
    "port": int(os.environ.get("DB_LMS_PORT", 3307)),
    "db": os.environ.get("DB_LMS_DATABASE", "app_jftbasic"),
    "user": os.environ.get("DB_LMS_USERNAME", "root"),
    "password": os.environ.get("DB_LMS_PASSWORD", "Minori@2025"),
    "charset": "utf8mb4",
}

_connection_pool: aiomysql.pool.Pool | None = None
_pool_lock = asyncio.Lock()


async def close_pool() -> None:
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.close()
        await _connection_pool.wait_closed()
        _connection_pool = None


async def _get_pool() -> aiomysql.pool.Pool:
    global _connection_pool
    if _connection_pool is None:
        async with _pool_lock:
            if _connection_pool is None:
                _connection_pool = await aiomysql.create_pool(**LMS_DB)
    return _connection_pool


async def get_lms_user(email: str) -> dict | None:
    """Fetch user from JFT Basic LMS DB by email, with roles."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, name, email, is_active FROM users WHERE email = %s",
                (email,),
            )
            row = await cur.fetchone()
            if not row or not row.get("is_active"):
                return None

            await cur.execute(
                "SELECT r.name FROM roles r "
                "JOIN model_has_roles mhr ON r.id = mhr.role_id "
                "WHERE mhr.model_type = 'App\\\\Models\\\\User' "
                "AND mhr.model_id = %s",
                (row["id"],),
            )
            role_rows = await cur.fetchall()
            role_names = [r["name"] for r in role_rows]

            # Map LMS roles to SpeechRecog roles
            if "admin" in role_names:
                role = "admin"
            elif any(r in role_names for r in ("guru", "guru pengganti")):
                role = "guru"
            else:
                role = "user"

            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": role,
                "role_names": role_names,
            }
