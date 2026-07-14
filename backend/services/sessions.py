"""Session persistence service — MongoDB via motor."""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import DESCENDING

from models.schemas import (
    SessionCreateRequest,
    SessionDoc,
    SessionMessageResponse,
    SessionPatchRequest,
    SessionTurn,
)

logger = logging.getLogger(__name__)

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.environ.get("MONGODB_DB", "speechrecog")
COLLECTION_NAME = "sessions"


class _Store:
    """Lazy-initialised Motor client wrapper."""

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
        await col.create_index("session_id", unique=True)
        await col.create_index([("started_at", DESCENDING)])
        await col.create_index("messages.scenario_switched")
    except Exception as exc:
        logger.warning("ensure_indexes failed: %s", exc)


async def ping() -> bool:
    try:
        if _Store.client is None:
            _Store.client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=1000)
        await _Store.client.admin.command("ping")
        return True
    except Exception as exc:
        logger.debug("MongoDB ping failed: %s", exc)
        return False


async def get_session(session_id: str) -> dict | None:
    doc = await _Store.get_collection().find_one({"session_id": session_id}, {"_id": 0})
    return doc


async def create_or_get_session(payload: SessionCreateRequest) -> dict:
    now = float(__import__("time").time())
    new_doc = {
        "session_id": payload.session_id,
        "started_at": now,
        "ended_at": None,
        "mode": payload.mode,
        "scenario_id": payload.scenario_id,
        "scenario_text": payload.scenario_text,
        "speaker_id": payload.speaker_id,
        "messages": [],
        "user_metadata": payload.user_metadata or {},
    }
    await _Store.get_collection().update_one(
        {"session_id": payload.session_id},
        {"$setOnInsert": new_doc},
        upsert=True,
    )
    stored = await get_session(payload.session_id)
    assert stored is not None
    return stored


async def patch_session(session_id: str, payload: SessionPatchRequest) -> dict | None:
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not patch:
        return await get_session(session_id)
    result = await _Store.get_collection().update_one(
        {"session_id": session_id}, {"$set": patch}
    )
    if result.matched_count == 0:
        return None
    return await get_session(session_id)


async def append_message(session_id: str, turn: SessionTurn) -> dict:
    result = await _Store.get_collection().update_one(
        {"session_id": session_id},
        {"$push": {"messages": turn.model_dump()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"turn": turn.turn}


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionDoc)
async def create_session(payload: SessionCreateRequest) -> Any:
    doc = await create_or_get_session(payload)
    return doc


@router.get("/{session_id}", response_model=SessionDoc)
async def get_one(session_id: str) -> Any:
    doc = await get_session(session_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return doc


@router.patch("/{session_id}", response_model=SessionDoc)
async def patch_one(session_id: str, payload: SessionPatchRequest) -> Any:
    doc = await patch_session(session_id, payload)
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return doc


@router.post("/{session_id}/messages", response_model=SessionMessageResponse)
async def append_one(session_id: str, turn: SessionTurn) -> Any:
    return await append_message(session_id, turn)