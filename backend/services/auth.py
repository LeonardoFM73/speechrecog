"""JWT authentication utilities."""

from __future__ import annotations

import hashlib
import os
import time
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


def verify_sso_token(token: str, sig: str, expiry: int, email: str) -> dict | None:
    secret = os.environ.get("SSO_SECRET", "123Minori!@#")
    expected_sig = hashlib.md5(f"{secret}|{token}|{expiry}|{email}".encode()).hexdigest()
    if sig != expected_sig:
        return None
    if expiry < time.time():
        return None
    if not email or '@' not in email:
        return None
    return {"token": token, "email": email, "expiry": expiry}
