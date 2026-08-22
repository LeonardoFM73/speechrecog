"""Session persistence service — MongoDB via motor."""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import DESCENDING

from models.schemas import (
    SessionCreateRequest,
    SessionDoc,
    SessionMessageResponse,
    SessionPatchRequest,
    SessionTurn,
)
from services import auth as auth_service

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
        await col.create_index("username")
        await col.create_index([("username", 1), ("started_at", DESCENDING)])
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


async def current_user(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: extract and verify JWT, return username."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    username = auth_service.decode_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username


async def get_session(session_id: str) -> dict | None:
    doc = await _Store.get_collection().find_one({"session_id": session_id}, {"_id": 0})
    return doc


async def list_user_sessions(username: str) -> list[dict]:
    cursor = _Store.get_collection().find({"username": username}, {"_id": 0}).sort("started_at", DESCENDING)
    return await cursor.to_list(length=None)


async def get_session_owned(session_id: str, username: str) -> dict | None:
    doc = await _Store.get_collection().find_one(
        {"session_id": session_id, "username": username}, {"_id": 0}
    )
    return doc


async def create_or_get_session(username: str, payload: SessionCreateRequest) -> dict:
    now = float(__import__("time").time())
    new_doc = {
        "session_id": payload.session_id,
        "username": username,
        "started_at": now,
        "ended_at": None,
        "mode": payload.mode,
        "scenario_id": payload.scenario_id,
        "scenario_text": payload.scenario_text,
        "speaker_id": payload.speaker_id,
        "tts_speed": payload.tts_speed,
        "jp_level": payload.jp_level,
        "max_turns": payload.max_turns,
        "messages": [],
        "user_metadata": payload.user_metadata or {},
    }
    await _Store.get_collection().update_one(
        {"session_id": payload.session_id},
        {"$setOnInsert": new_doc},
        upsert=True,
    )
    stored = await get_session_owned(payload.session_id, username)
    assert stored is not None
    return stored


async def patch_session(session_id: str, username: str, payload: SessionPatchRequest) -> dict | None:
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not patch:
        return await get_session_owned(session_id, username)
    result = await _Store.get_collection().update_one(
        {"session_id": session_id, "username": username}, {"$set": patch}
    )
    if result.matched_count == 0:
        return None
    return await get_session_owned(session_id, username)


async def append_message(session_id: str, username: str, turn: SessionTurn) -> dict:
    result = await _Store.get_collection().update_one(
        {"session_id": session_id, "username": username},
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
async def create_session(
    payload: SessionCreateRequest, username: str = Depends(current_user)
) -> Any:
    try:
        doc = await create_or_get_session(username, payload)
        return doc
    except Exception as exc:
        logger.exception("create_session failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", response_model=list[SessionDoc])
async def list_sessions(username: str = Depends(current_user)) -> Any:
    try:
        sessions = await list_user_sessions(username)
        logger.info("list_sessions: found %d sessions for %s", len(sessions), username)
        return sessions
    except Exception as exc:
        logger.exception("list_sessions failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"list_sessions: {type(exc).__name__}: {exc}")


@router.get("/{session_id}", response_model=SessionDoc)
async def get_one(session_id: str, username: str = Depends(current_user)) -> Any:
    try:
        doc = await get_session_owned(session_id, username)
        if not doc:
            raise HTTPException(status_code=404, detail="Session not found")
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_one failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/{session_id}", response_model=SessionDoc)
async def patch_one(
    session_id: str, payload: SessionPatchRequest, username: str = Depends(current_user)
) -> Any:
    try:
        doc = await patch_session(session_id, username, payload)
        if not doc:
            raise HTTPException(status_code=404, detail="Session not found")
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("patch_one failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{session_id}/messages", response_model=SessionMessageResponse)
async def append_one(
    session_id: str, turn: SessionTurn, username: str = Depends(current_user)
) -> Any:
    try:
        return await append_message(session_id, username, turn)
    except Exception as exc:
        logger.exception("append_one failed")
        raise HTTPException(status_code=500, detail=str(exc))
