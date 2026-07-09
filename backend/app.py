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
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from loguru import logger

from models.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    SpeakersResponse,
    TranscribeResponse,
    TtsRequest,
)
from services.transcriber import initialise, get_service
from services import chat as chat_service
from services import tts as tts_service

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

    initialise(model_size="medium", device=device, compute_type="float16" if device == "cuda" else "int8")
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
        await tts_service.initialise(base_url=voicevox_url, default_speaker=voicevox_speaker)
        logger.info("TTS service ready (VOICEVOX)")
    except Exception as exc:
        logger.warning("TTS service disabled: %s (start VOICEVOX engine to enable)", exc)

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

    # Cleanup temp files on shutdown
    for f in UPLOAD_DIR.glob("*"):
        f.unlink()
    logger.info("Temp files cleaned up on shutdown")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Japanese Speech-to-Text",
    description="Local transcription using Faster-Whisper Medium",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health() -> Any:
    """Health check — returns GPU, model, chat, and TTS status."""
    svc = get_service()
    return {
        "status": "ok",
        "gpu": svc.current_device,
        "model_loaded": svc.is_loaded,
        "chat_ready": chat_service.is_ready(),
        "tts_ready": tts_service.is_ready(),
    }


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
        wav_bytes = await tts_service.get_service().synthesise(req.text, speaker)
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
        result = chat_service.get_service().chat(
            user_text=req.user_text,
            scenario=req.scenario,
            history=req.history,  # history BEFORE this user turn
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
