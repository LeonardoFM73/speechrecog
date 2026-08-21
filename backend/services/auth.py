"""JWT authentication utilities."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = int(os.environ.get("JWT_EXPIRY_DAYS", "30"))


def create_token(username: str, role: str = "user") -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, str] | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "username": payload.get("sub"),
            "role": payload.get("role", "user"),
        }
    except jwt.PyJWTError:
        return None
