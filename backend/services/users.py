"""User persistence service — MongoDB via motor."""

from __future__ import annotations

import logging
import os

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.environ.get("MONGODB_DB", "speechrecog")
COLLECTION_NAME = "users"


class _Store:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    @classmethod
    def get_collection(cls) -> AsyncIOMotorCollection:
        if cls.client is None:
            cls.client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=2000)
            cls.db = cls.client[DB_NAME]
        assert cls.db is not None
        return cls.db[COLLECTION_NAME]


async def ensure_indexes() -> None:
    try:
        col = _Store.get_collection()
        await col.create_index("username", unique=True)
    except Exception as exc:
        logger.warning("users ensure_indexes failed: %s", exc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


async def get_user(username: str) -> dict | None:
    col = _Store.get_collection()
    doc = await col.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    return doc


async def create_user(username: str, password_hash: str) -> dict:
    col = _Store.get_collection()
    now = float(__import__("time").time())
    new_doc = {
        "username": username,
        "password_hash": password_hash,
        "created_at": now,
    }
    await col.insert_one(new_doc)
    return {"username": username, "created_at": now}


async def get_user_by_username(username: str) -> dict | None:
    col = _Store.get_collection()
    doc = await col.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    return doc
