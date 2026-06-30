"""TTS service — wraps a local VOICEVOX Engine HTTP API.

Singleton pattern, parallel to services/transcriber.py and services/chat.py.
VOICEVOX must be running (locally or as a separate container). If the engine
is unreachable at startup we log a warning and continue; /tts will return 503
until the engine comes up, but /transcribe and /chat still work.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class TtsService:
    """Thin async wrapper around VOICEVOX Engine's /audio_query and /synthesis."""

    _instance: "TtsService | None" = None

    def __init__(
        self,
        base_url: str,
        default_speaker: int,
        timeout: float = 15.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._default_speaker = default_speaker
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None
        self._speakers_cache: list[dict[str, Any]] | None = None

    # ------------------------------------------------------------------
    async def initialise(self) -> None:
        """Create HTTP client and warm up the speaker cache.

        Raises if VOICEVOX is unreachable — caller should catch and degrade
        gracefully (see app.py lifespan).
        """
        if self._client is not None:
            return
        self._client = httpx.AsyncClient(timeout=self._timeout)
        # Warm-up: triggers a real HTTP call so connection issues surface now,
        # not on the first /tts request.
        await self.list_speakers(force=True)
        logger.info(
            "TtsService initialised (VOICEVOX) base_url=%s default_speaker=%d",
            self._base_url,
            self._default_speaker,
        )

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    @property
    def is_loaded(self) -> bool:
        return self._client is not None

    @property
    def default_speaker(self) -> int:
        return self._default_speaker

    # ------------------------------------------------------------------
    async def list_speakers(self, force: bool = False) -> list[dict[str, Any]]:
        """Return flat list of (character, style) pairs from GET /speakers.

        Each entry: {id, name, style, label}. Cache is invalidated on `force=True`
        or on the initialise() warm-up call.
        """
        if self._client is None:
            raise RuntimeError("TtsService client not initialised")

        if self._speakers_cache is not None and not force:
            return self._speakers_cache

        resp = await self._client.get(f"{self._base_url}/speakers")
        resp.raise_for_status()
        raw = resp.json()

        flat: list[dict[str, Any]] = []
        for sp in raw:
            char_name = sp.get("name", "")
            for style in sp.get("styles", []):
                flat.append(
                    {
                        "id": int(style["id"]),
                        "name": char_name,
                        "style": str(style.get("name", "")),
                        "label": f"{char_name} — {style.get('name', '')}",
                    }
                )
        self._speakers_cache = flat
        logger.info("Loaded %d VOICEVOX speakers", len(flat))
        return flat

    # ------------------------------------------------------------------
    async def synthesise(self, text: str, speaker: int) -> bytes:
        """Two-step synthesis: POST /audio_query → POST /synthesis. Returns WAV bytes.

        Raises:
            ValueError: empty text.
            httpx.HTTPError: VOICEVOX returned non-2xx (propagated from httpx).
        """
        if self._client is None:
            raise RuntimeError("TtsService client not initialised")
        if not text or not text.strip():
            raise ValueError("text is empty")

        # Step 1: build AudioQuery
        q = await self._client.post(
            f"{self._base_url}/audio_query",
            params={"speaker": speaker, "text": text},
        )
        q.raise_for_status()
        query = q.json()

        # Step 2: synthesise to WAV
        s = await self._client.post(
            f"{self._base_url}/synthesis",
            params={"speaker": speaker},
            json=query,
        )
        s.raise_for_status()
        return s.content  # audio/wav bytes


# ---------------------------------------------------------------------------
# Module-level convenience accessors (initialised by app.py startup)
# ---------------------------------------------------------------------------
_tts_service: TtsService | None = None


def get_service() -> TtsService:
    """Return the singleton TtsService. Raises if not initialised."""
    global _tts_service
    if _tts_service is None:
        raise RuntimeError("TtsService not initialised. Call initialise() first.")
    return _tts_service


def is_ready() -> bool:
    """True if the TTS service was successfully initialised and the engine was reachable."""
    return _tts_service is not None and _tts_service.is_loaded


async def initialise(base_url: str, default_speaker: int) -> TtsService:
    """Create the singleton and warm it up.

    Raises httpx.HTTPError if the engine is unreachable — caller should
    catch and degrade gracefully (see app.py lifespan).
    """
    global _tts_service
    if _tts_service is not None:
        return _tts_service
    _tts_service = TtsService(
        base_url=base_url,
        default_speaker=default_speaker,
    )
    await _tts_service.initialise()
    return _tts_service


async def aclose() -> None:
    """Close the underlying HTTP client. Idempotent."""
    global _tts_service
    if _tts_service is not None:
        await _tts_service.aclose()
        _tts_service = None
