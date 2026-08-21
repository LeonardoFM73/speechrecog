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


ROLES = ("user", "admin")


async def get_user(username: str) -> dict | None:
    col = _Store.get_collection()
    doc = await col.find_one({"username": username}, {"_id": 0})
    if doc:
        doc.setdefault("role", "user")
    return doc


async def create_user(username: str, password_hash: str, role: str = "user") -> dict:
    col = _Store.get_collection()
    now = float(__import__("time").time())
    new_doc = {
        "username": username,
        "password_hash": password_hash,
        "role": role,
        "created_at": now,
    }
    await col.insert_one(new_doc)
    return {"username": username, "role": role, "created_at": now}


async def update_role(username: str, role: str) -> dict | None:
    if role not in ROLES:
        return None
    col = _Store.get_collection()
    result = await col.update_one(
        {"username": username},
        {"$set": {"role": role}},
    )
    if result.matched_count == 0:
        return None
    return {"username": username, "role": role}


async def seed_admin_user() -> None:
    """Create default admin user if not exists."""
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if not admin_password:
        return
    existing = await get_user(admin_username)
    if existing:
        logger.info("Admin user '%s' already exists", admin_username)
        return
    password_hash = hash_password(admin_password)
    await create_user(admin_username, password_hash, role="admin")
    logger.info("Created default admin user: %s", admin_username)


async def get_user_by_username(username: str) -> dict | None:
    col = _Store.get_collection()
    doc = await col.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    return doc
