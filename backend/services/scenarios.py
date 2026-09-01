"""Scenario management service — MongoDB via motor.

Handles both roleplay presets/custom and Kaiwa Renshuu scenarios in a single
collection with a kind discriminator.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from models.schemas import (
    ScenarioCreateRequest,
    ScenarioDoc,
    ScenarioKindConfig,
    ScenarioUpdateRequest,
)
from services import auth as auth_service

logger = logging.getLogger(__name__)

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.environ.get("MONGODB_DB", "speechrecog")
COLLECTION_NAME = "scenarios"


class _Store:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    @classmethod
    def get_collection(cls) -> AsyncIOMotorCollection:
        try:
            if cls.client is None:
                cls.client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=2000)
            if cls.db is None:
                cls.db = cls.client[DB_NAME]
            return cls.db[COLLECTION_NAME]
        except Exception as exc:
            logger.error("Failed to get scenarios collection: %s", exc)
            raise RuntimeError(f"MongoDB connection failed: {exc}") from exc


async def ensure_indexes() -> None:
    try:
        col = _Store.get_collection()
        await col.create_index("scenario_id", unique=True)
        await col.create_index("kind")
        await col.create_index("is_preset")
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


async def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    user = auth_service.decode_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


async def check_admin(authorization: str | None = Header(default=None)) -> dict:
    user = await current_user(authorization)
    doc = await _Store.get_collection().database["users"].find_one(
        {"username": user["username"]}, {"_id": 0, "role": 1}
    )
    if not doc or doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


PRESET_SCENARIOS = [
    {
        "scenario_id": "taxi_station",
        "kind": "roleplay",
        "label": "Supir Taksi di Stasiun",
        "emoji": "🚕",
        "description": "あなたは東京でタクシーの運転手です。ユーザーが今、主要な駅でタクシーを探しています。",
        "is_preset": True,
    },
    {
        "scenario_id": "convenience_store",
        "kind": "roleplay",
        "label": "Di Minimarket",
        "emoji": "🏪",
        "description": "あなたはコンビニの店員です。ユーザーが商品を探しています。",
        "is_preset": True,
    },
    {
        "scenario_id": "restaurant",
        "kind": "roleplay",
        "label": "Di Restoran",
        "emoji": "🍜",
        "description": "あなたはレストランのウェイターです。ユーザーが注文しようとしています。",
        "is_preset": True,
    },
    {
        "scenario_id": "train_station",
        "kind": "roleplay",
        "label": "Di Loket Tiket",
        "emoji": "🚆",
        "description": "あなたは駅の窓口係員です。ユーザーが切符を買おうとしています。",
        "is_preset": True,
    },
    {
        "scenario_id": "doctor",
        "kind": "roleplay",
        "label": "Di Dokter",
        "emoji": "🏥",
        "description": "あなたは医者です。ユーザーが症状を説明しに来ました。",
        "is_preset": True,
    },
]


async def seed_preset_scenarios() -> None:
    now = float(time.time())
    col = _Store.get_collection()
    for preset in PRESET_SCENARIOS:
        doc = {**preset, "created_at": now, "updated_at": now}
        await col.update_one(
            {"scenario_id": preset["scenario_id"]},
            {"$set": doc},
            upsert=True,
        )
    logger.info("Seeded %d preset scenarios", len(PRESET_SCENARIOS))


async def list_scenarios(kind: str | None = None) -> list[dict]:
    query: dict[str, Any] = {}
    if kind:
        query["kind"] = kind
    cursor = _Store.get_collection().find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=None)


async def get_scenario(scenario_id: str) -> dict | None:
    doc = await _Store.get_collection().find_one({"scenario_id": scenario_id}, {"_id": 0})
    return doc


async def create_scenario(username: str, payload: ScenarioCreateRequest) -> dict:
    now = float(time.time())
    doc = {
        "scenario_id": payload.kind + "_" + str(now),
        "kind": payload.kind,
        "label": payload.label,
        "emoji": payload.emoji,
        "description": payload.description,
        "is_preset": False,
        "created_by": username,
        "created_at": now,
        "updated_at": now,
        "kind_config": payload.kind_config.model_dump(),
    }
    await _Store.get_collection().insert_one(doc)
    logger.info("Created scenario %s by %s", doc["scenario_id"], username)
    doc.pop("_id", None)
    return doc


async def update_scenario(scenario_id: str, username: str, payload: ScenarioUpdateRequest) -> dict | None:
    col = _Store.get_collection()
    existing = await col.find_one({"scenario_id": scenario_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if existing.get("is_preset"):
        raise HTTPException(status_code=400, detail="Cannot update preset scenario")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not patch:
        return existing
    patch["updated_at"] = float(time.time())
    result = await col.update_one(
        {"scenario_id": scenario_id},
        {"$set": patch},
    )
    if result.matched_count == 0:
        return None
    return await get_scenario(scenario_id)


async def delete_scenario(scenario_id: str, username: str) -> bool:
    col = _Store.get_collection()
    existing = await col.find_one({"scenario_id": scenario_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if existing.get("is_preset"):
        raise HTTPException(status_code=400, detail="Cannot delete preset scenario")
    result = await col.delete_one({"scenario_id": scenario_id})
    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# Public scenario list endpoint
# ---------------------------------------------------------------------------
public_router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@public_router.get("", response_model=list[dict])
async def public_list_endpoint(kind: str | None = None) -> Any:
    try:
        return await list_scenarios(kind=kind)
    except Exception as exc:
        logger.exception("public_list_scenarios failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/admin/scenarios", tags=["scenarios"])


@router.get("", response_model=list[dict])
async def list_endpoint(
    kind: str | None = None,
    _admin: dict = Depends(check_admin),
) -> Any:
    try:
        return await list_scenarios(kind=kind)
    except Exception as exc:
        logger.exception("list_scenarios failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("", response_model=dict)
async def create_endpoint(
    payload: ScenarioCreateRequest,
    admin: dict = Depends(check_admin),
) -> Any:
    try:
        return await create_scenario(admin["username"], payload)
    except Exception as exc:
        logger.exception("create_scenario failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/{scenario_id}", response_model=dict)
async def update_endpoint(
    scenario_id: str,
    payload: ScenarioUpdateRequest,
    admin: dict = Depends(check_admin),
) -> Any:
    try:
        doc = await update_scenario(scenario_id, admin["username"], payload)
        if not doc:
            raise HTTPException(status_code=404, detail="Scenario not found")
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_scenario failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{scenario_id}")
async def delete_endpoint(
    scenario_id: str,
    admin: dict = Depends(check_admin),
) -> Any:
    try:
        deleted = await delete_scenario(scenario_id, admin["username"])
        if not deleted:
            raise HTTPException(status_code=404, detail="Scenario not found")
        return {"deleted": scenario_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("delete_scenario failed")
        raise HTTPException(status_code=500, detail=str(exc))
