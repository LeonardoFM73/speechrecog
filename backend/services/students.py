"""Student persistence — MySQL via aiomysql."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os

import aiomysql

logger = logging.getLogger(__name__)

STUDENT_DB = {
    "host": os.environ.get("DB_STUDENT_HOST", "38.47.176.99"),
    "port": int(os.environ.get("DB_STUDENT_PORT", 3306)),
    "db": os.environ.get("DB_STUDENT_DATABASE", "dbminori_student_minori"),
    "user": os.environ.get("DB_STUDENT_USERNAME", "dbminori_student_minori"),
    "password": os.environ.get("DB_STUDENT_PASSWORD", "stduser!@#"),
    "charset": "utf8mb4",
}

_connection_pool: aiomysql.pool.Pool | None = None
_pool_lock = asyncio.Lock()


async def _get_pool() -> aiomysql.pool.Pool:
    global _connection_pool
    if _connection_pool is None:
        async with _pool_lock:
            if _connection_pool is None:
                _connection_pool = await aiomysql.create_pool(**STUDENT_DB)
    return _connection_pool


def md5_hash(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()


async def find_student(user_name: str) -> dict | None:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, user_name, password, nama_user, email, kondisi_sekarang "
                "FROM users WHERE user_name = %s",
                (user_name,),
            )
            row = await cur.fetchone()
            return dict(row) if row else None


def verify_password(raw: str, stored: str) -> bool:
    return md5_hash(raw) == stored


async def ensure_in_mongodb(student: dict) -> None:
    import services.users as users_service

    username = student["user_name"]
    existing = await users_service.get_user(username)
    if existing:
        col = users_service._Store.get_collection()
        await col.update_one(
            {"username": username},
            {"$set": {"student_name": student["nama_user"]}},
        )
    else:
        await users_service.create_user(username, "$student$", role="user")
