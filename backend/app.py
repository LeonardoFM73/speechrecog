"""FastAPI application — Japanese Speech-to-Text backend."""

from __future__ import annotations

import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, HTTPException, Header, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from loguru import logger

from models.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    KaiwaChatRequest,
    RoleUpdateRequest,
    SpeakersResponse,
    TranscribeResponse,
    TtsRequest,
)
from services.transcriber import initialise, get_service
from services import chat as chat_service
from services import tts as tts_service
from services import sessions as sessions_service
from services import users as users_service
from services import students as students_service
from services import auth as auth_service
from services import scenarios as scenarios_service
from services import lms_users as lms_users_service
from models.schemas import UserCreateRequest, LoginRequest, TokenResponse

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("app")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_AUDIO_SIZE_MB: int = 20
UPLOAD_DIR: Path = Path(tempfile.mkdtemp(prefix="whisper_audio_"))

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup; clean temp files on shutdown."""
    # Detect GPU
    try:
        import torch  # type: ignore[import-not-found,unused-ignore]

        has_cuda = torch.cuda.is_available()
        device = "cuda" if has_cuda else "cpu"
        logger.info("CUDA available: %s → device=%s", has_cuda, device)
    except ImportError:
        device = "cpu"
        logger.info("torch not installed → using CPU")

    model_size = os.environ.get("WHISPER_MODEL_SIZE", "large-v3-turbo")
    initialise(model_size=model_size, device=device, compute_type="float16" if device == "cuda" else "int8")
    logger.info("FastAPI application started — device=%s", get_service().current_device)

    # Chat (LLM) service — optional. If OPENAI_BASE_URL is unset, log a warning
    # and continue; /chat will return 503 until the endpoint is reachable.
    try:
        chat_service.initialise()
        logger.info("Chat service ready (OpenAI-compatible)")
    except RuntimeError as exc:
        logger.warning("Chat service disabled: %s (set OPENAI_BASE_URL to enable)", exc)

    # TTS (VOICEVOX) service — optional. If the engine is unreachable,
    # log a warning and continue; /tts will return 503 until the engine comes up.
    try:
        voicevox_url = os.environ.get("VOICEVOX_URL", "http://10.100.101.12:50021")
        voicevox_speaker = int(os.environ.get("VOICEVOX_DEFAULT_SPEAKER", "2"))
        voicevox_speed = float(os.environ.get("VOICEVOX_DEFAULT_SPEED", "1.0"))
        await tts_service.initialise(
            base_url=voicevox_url,
            default_speaker=voicevox_speaker,
            default_speed=voicevox_speed,
        )
        logger.info("TTS service ready (VOICEVOX) speed=%s", voicevox_speed)
    except Exception as exc:
        logger.warning("TTS service disabled: %s (start VOICEVOX engine to enable)", exc)

    # Users — MongoDB is optional.
    try:
        await users_service.ensure_indexes()
        await users_service.seed_admin_user()
        if await sessions_service.ping():
            logger.info("Users ready (MongoDB at %s)", os.environ.get("MONGODB_URL", "mongodb://mongo:27017"))
        else:
            logger.warning("Users: MongoDB unreachable")
    except Exception as exc:
        logger.warning("Users disabled: %s", exc)

    # Sessions — MongoDB is optional. If unreachable, /sessions returns 503
    # but transcription / chat / TTS still work.
    try:
        await sessions_service.ensure_indexes()
        if await sessions_service.ping():
            logger.info("Sessions ready (MongoDB at %s)", os.environ.get("MONGODB_URL", "mongodb://mongo:27017"))
        else:
            logger.warning("Sessions: MongoDB unreachable — /sessions will return 503")
    except Exception as exc:
        logger.warning("Sessions disabled: %s", exc)

    # Scenarios — seed presets, ensure indexes.
    try:
        await scenarios_service.ensure_indexes()
        await scenarios_service.seed_preset_scenarios()
        if await scenarios_service.ping():
            logger.info("Scenarios ready (MongoDB at %s)", os.environ.get("MONGODB_URL", "mongodb://mongo:27017"))
        else:
            logger.warning("Scenarios: MongoDB unreachable")
    except Exception as exc:
        logger.warning("Scenarios disabled: %s", exc)

    yield

    # TTS shutdown — close HTTP client
    try:
        await tts_service.aclose()
    except Exception:
        pass

    # Chat shutdown — close HTTP client
    try:
        await chat_service.aclose()
    except Exception:
        pass

    # MongoDB client close
    try:
        if sessions_service._Store.client is not None:
            sessions_service._Store.client.close()
    except Exception:
        pass
    try:
        if scenarios_service._Store.client is not None:
            scenarios_service._Store.client.close()
    except Exception:
        pass

    # LMS MySQL pool close
    try:
        await lms_users_service.close_pool()
    except Exception:
        pass

    # Cleanup temp files on shutdown
    for f in UPLOAD_DIR.glob("*"):
        f.unlink()
    logger.info("Temp files cleaned up on shutdown")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Japanese Speech-to-Text",
    description="Local transcription using Faster-Whisper Large",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ai-dev-kaiwa.minori.co.id", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def universal_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return JSON with CORS headers for all exceptions."""
    import traceback
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    logger.error("Unhandled exception: %s\n%s", exc, "".join(tb))

    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail or type(exc).__name__
    else:
        # Handle Pydantic validation errors
        status_code = 500
        if hasattr(exc, 'errors'):
            detail = f"{type(exc).__name__}: {exc.errors()}"
        else:
            detail = f"{type(exc).__name__}: {exc}"
        logger.warning("Response validation failed: %s", exc)

    headers = {"Access-Control-Allow-Origin": "*"}
    return JSONResponse(
        content={"detail": detail},
        status_code=status_code,
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health() -> Any:
    """Health check — returns GPU, model, chat, TTS, and DB status."""
    svc = get_service()
    db_ok = await sessions_service.ping()
    return {
        "status": "ok",
        "gpu": svc.current_device,
        "model_loaded": svc.is_loaded,
        "chat_ready": chat_service.is_ready(),
        "tts_ready": tts_service.is_ready(),
        "db_ready": db_ok,
    }


@app.get("/debug/test-exception")
async def debug_test_exception() -> Any:
    """Test endpoint to verify exception handling."""
    raise ValueError("test error message")


# ---------------------------------------------------------------------------
# TTS (VOICEVOX) endpoints
# ---------------------------------------------------------------------------
@app.get("/speakers", response_model=SpeakersResponse)
async def list_speakers() -> Any:
    """Return all VOICEVOX speakers (flattened character × style pairs)."""
    if not tts_service.is_ready():
        raise HTTPException(status_code=503, detail="TTS service not ready (VOICEVOX unreachable)")
    speakers = await tts_service.get_service().list_speakers()
    return {"speakers": speakers}


@app.post("/tts")
async def tts(req: TtsRequest) -> Response:
    """Synthesise Japanese text → WAV audio stream.

    Delegates to the local VOICEVOX Engine via /audio_query → /synthesis.
    Returns ``audio/wav`` (24 kHz, PCM). Failure is non-fatal — if the engine
    is down the caller still gets text replies from /chat.
    """
    if not tts_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail="TTS service not ready. Is VOICEVOX engine running on VOICEVOX_URL?",
        )

    speaker = req.speaker or tts_service.get_service().default_speaker

    try:
        wav_bytes = await tts_service.get_service().synthesise(
            req.text, speaker, speed=req.speed
        )
    except httpx.HTTPError as exc:
        logger.error("VOICEVOX HTTP error: %s", exc)
        raise HTTPException(status_code=502, detail=f"VOICEVOX engine error: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return Response(content=wav_bytes, media_type="audio/wav")


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)) -> Any:
    """Accept an audio file and return Japanese transcription."""
    svc = get_service()

    if not svc.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # Validate content type
    content_type = audio.content_type or "application/octet-stream"
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail=f"Expected audio file, got {content_type}")

    # Read and validate size
    audio_data = await audio.read()
    file_size_mb = len(audio_data) / (1024 * 1024)

    if file_size_mb > MAX_AUDIO_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"Audio too large: {file_size_mb:.1f} MB (max {MAX_AUDIO_SIZE_MB} MB)")

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    # Write to temp file for Whisper
    suffix = ".wav" if audio.filename and audio.filename.endswith(".wav") else ".webm"
    tmp_path = UPLOAD_DIR / f"{int(time.time())}{suffix}"
    tmp_path.write_bytes(audio_data)

    try:
        result = svc.transcribe(tmp_path)
        return result
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except RuntimeError as exc:
        logger.error("Transcription runtime error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


# ---------------------------------------------------------------------------
# Chat (roleplay) endpoint
# ---------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> Any:
    """Send user text + scenario + history to the LLM, get a Japanese reply.

    The STT pipeline is not invoked here — the client first calls /transcribe
    to get the Japanese text, then calls /chat with that text + scenario +
    accumulated history.
    """
    if not chat_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Chat service is not available. Set OPENAI_BASE_URL and restart the backend.",
        )

    # Build the new history (current user turn appended, model's turn appended at end).
    new_history = list(req.history) + [
        {"role": "user", "text": req.user_text},
    ]

    try:
        result = await chat_service.get_service().chat(
            user_text=req.user_text,
            scenario=req.scenario,
            history=req.history,  # history BEFORE this user turn
            jp_level=req.jp_level,
            max_turns=req.max_turns,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("LLM call failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"LLM provider error: {exc}")

    new_history.append({"role": "model", "text": result["reply_jp"]})

    return {
        "success": True,
        "reply_jp": result["reply_jp"],
        "reply_translation": result["reply_translation"],
        "history": new_history,
        "error": None,
    }


# ---------------------------------------------------------------------------
# Kaiwa Renshuu endpoint
# ---------------------------------------------------------------------------
@app.post("/kaiwa/chat", response_model=ChatResponse)
async def kaiwa_chat(req: KaiwaChatRequest) -> Any:
    """Kaiwa Renshuu — teacher-led Japanese practice with topic focus.

    Looks up the kaiwa scenario by scenario_id, finds the question by
    question_id, then delegates to ChatService.kaiwa_chat().
    """
    if not chat_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Chat service is not available. Set OPENAI_BASE_URL and restart the backend.",
        )

    scenario = await scenarios_service.get_scenario(req.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if scenario.get("kind") != "kaiwa":
        raise HTTPException(status_code=400, detail="Scenario is not a kaiwa scenario")

    questions = (scenario.get("kind_config") or {}).get("questions", [])
    question_doc = next((q for q in questions if q.get("id") == req.question_id), None)
    if not question_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Question '{req.question_id}' not found in scenario",
        )

    new_history = list(req.history) + [
        {"role": "user", "text": req.user_text},
    ]

    try:
        result = await chat_service.get_service().kaiwa_chat(
            user_text=req.user_text,
            scenario_description=scenario.get("description", ""),
            question=question_doc.get("question", ""),
            question_topic_hint=question_doc.get("topic_hint", ""),
            history=req.history,
            jp_level=req.jp_level,
            max_turns=req.max_turns,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Kaiwa LLM call failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"LLM provider error: {exc}")

    new_history.append({"role": "model", "text": result["reply_jp"]})

    return {
        "success": True,
        "reply_jp": result["reply_jp"],
        "reply_translation": result["reply_translation"],
        "history": new_history,
        "error": None,
    }


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@app.post("/auth/register", response_model=TokenResponse)
async def register(payload: UserCreateRequest) -> Any:
    existing = await users_service.get_user(payload.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    password_hash = users_service.hash_password(payload.password)
    await users_service.create_user(payload.username, password_hash)
    token = auth_service.create_token(payload.username)
    user_doc = await users_service.get_user(payload.username)
    role = user_doc.get("role", "user") if user_doc else "user"
    return {"access_token": token, "token_type": "bearer", "username": payload.username, "role": role}


@app.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> Any:
    try:
        user = await users_service.get_user(payload.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not users_service.verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        active = await users_service.is_user_active(payload.username)
        if not active:
            raise HTTPException(status_code=401, detail="Akun dinonaktifkan")
        token = auth_service.create_token(user["username"], user.get("role", "user"))
        return {"access_token": token, "token_type": "bearer", "username": user["username"], "role": user.get("role", "user")}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("login failed for %s", payload.username)
        raise HTTPException(status_code=500, detail=f"Login error: {exc}")


@app.get("/auth/me")
async def me(authorization: str | None = Header(default=None)) -> Any:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    decoded = auth_service.decode_token(authorization[len("Bearer "):])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"username": decoded["username"], "role": decoded["role"]}


@app.post("/auth/login-student", response_model=TokenResponse)
async def login_student(payload: LoginRequest) -> Any:
    try:
        student = await students_service.find_student(payload.username)
        if not student:
            raise HTTPException(status_code=401, detail="ID Pemagang tidak ditemukan")
        if student["kondisi_sekarang"] not in ("Sedang Pendidikan", "Sedang Pemagangan"):
            raise HTTPException(status_code=401, detail="Status siswa tidak aktif")
        if not students_service.verify_password(payload.password, student["password"]):
            raise HTTPException(status_code=401, detail="Password salah")
        await students_service.ensure_in_mongodb(student)
        token = auth_service.create_token(student["user_name"], "user")
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": student["user_name"],
            "role": "user",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("student login failed for %s", payload.username)
        raise HTTPException(status_code=500, detail=f"Login error: {exc}")


@app.post("/admin/users/{username}/role", response_model=TokenResponse)
async def admin_update_role(
    username: str,
    payload: RoleUpdateRequest,
    authorization: str | None = Header(default=None),
) -> Any:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    decoded = auth_service.decode_token(authorization[len("Bearer "):])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if decoded["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    existing = await users_service.get_user(username)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await users_service.update_role(username, payload.role)
    if not updated:
        raise HTTPException(status_code=400, detail="Invalid role")
    new_token = auth_service.create_token(username, payload.role)
    return {"access_token": new_token, "token_type": "bearer", "username": username, "role": payload.role}


@app.delete("/admin/users/{username}")
async def admin_delete_user(
    username: str,
    authorization: str | None = Header(default=None),
) -> Any:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    decoded = auth_service.decode_token(authorization[len("Bearer "):])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if decoded["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    existing = await users_service.get_user(username)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    deleted = await users_service.delete_user(username)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    return {"deleted": username}


@app.get("/admin/users", response_model=list[dict])
async def admin_list_users(
    authorization: str | None = Header(default=None),
) -> Any:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    decoded = auth_service.decode_token(authorization[len("Bearer "):])
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if decoded["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    col = users_service._Store.get_collection()
    users = await col.find({}, {"_id": 0, "password_hash": 0}).to_list(length=None)
    for u in users:
        u.setdefault("role", "user")
    return users


# ---------------------------------------------------------------------------
# SSO endpoints
# ---------------------------------------------------------------------------
@app.get("/sso-callback")
async def sso_callback(
    token: str = Query(...),
    email: str = Query(...),
    role: str = Query("user"),
    expiry: int = Query(...),
    sig: str = Query(...),
):
    verified = auth_service.verify_sso_token(token, sig, expiry, email)
    if not verified:
        raise HTTPException(status_code=403, detail="Invalid or expired SSO token")

    lms_user = await lms_users_service.get_lms_user(email)
    if not lms_user:
        raise HTTPException(status_code=403, detail="User not found or inactive in JFT Basic LMS")

    jwt_token = auth_service.create_token(email, lms_user["role"])
    frontend_url = os.environ.get("NEXT_PUBLIC_API_URL", "https://ai-dev-kaiwa.minori.co.id")
    base = frontend_url.rstrip('/')
    callback_url = f"{base}/sso-login?jwt={jwt_token}&username={email}&role={lms_user['role']}"
    return RedirectResponse(url=callback_url, status_code=302)


@app.get("/sso-logout")
async def sso_logout():
    frontend_url = os.environ.get("NEXT_PUBLIC_API_URL", "https://ai-dev-kaiwa.minori.co.id")
    return RedirectResponse(url=frontend_url, status_code=302)


# ---------------------------------------------------------------------------
# Session persistence router
# ---------------------------------------------------------------------------
app.include_router(sessions_service.router)
app.include_router(scenarios_service.router)
app.include_router(scenarios_service.public_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)

