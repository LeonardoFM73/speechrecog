"""Faster-Whisper transcription service — singleton pattern."""

from __future__ import annotations

import logging
import time
from pathlib import Path

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Wraps a single WhisperModel instance and provides transcription."""

    _instance: TranscriptionService | None = None
    _model: WhisperModel | None = None

    def __init__(self, model_size: str = "large-v3-turbo", device: str = "cuda", compute_type: str = "float16"):
        self._model_size = model_size
        self._device = device
        self._compute_type = compute_type
        self._model: WhisperModel | None = None

    # ------------------------------------------------------------------
    def load_model(self) -> None:
        """Load the Faster-Whisper model once at startup."""
        if self._model is not None:
            logger.info("Model already loaded, skipping reload")
            return

        logger.info("Loading Faster-Whisper model=%s device=%s compute=%s",
                     self._model_size, self._device, self._compute_type)
        start = time.monotonic()

        try:
            self._model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type,
                cpu_threads=4,
                num_workers=2,
            )
            elapsed = time.monotonic() - start
            logger.info("Model loaded successfully in %.2f s", elapsed)
        except Exception:
            logger.exception("Failed to load model on %s, falling back to cpu", self._device)
            self._model = WhisperModel(
                self._model_size,
                device="cpu",
                compute_type="int8",
                cpu_threads=4,
                num_workers=1,
            )
            elapsed = time.monotonic() - start
            logger.info("Model loaded on CPU in %.2f s (fallback)", elapsed)

    # ------------------------------------------------------------------
    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def current_device(self) -> str:
        if self._model is None:
            return "unknown"
        return self._device

    # ------------------------------------------------------------------
    def transcribe(self, audio_path: Path | str, timeout_seconds: float = 30.0) -> dict:
        """Transcribe an audio file and return results."""
        if self._model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        audio_path = Path(audio_path)
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        logger.info("Transcribing file=%s size=%.2f MB", audio_path.name, file_size_mb)

        start = time.monotonic()
        try:
            segments, info = self._model.transcribe(
                str(audio_path),
                language="ja",
                task="transcribe",
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                condition_on_previous_text=False,
                initial_prompt="これは日本語の会話です。",
                temperature=0,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
                word_timestamps=True,
            )

            text_parts: list[str] = []
            duration = 0.0
            for seg in segments:
                text_parts.append(seg.text.strip())
                duration = seg.end

            elapsed = time.monotonic() - start
            full_text = " ".join(text_parts).strip()

            logger.info(
                "Transcription complete in %.2f s — lang=%s dur=%.1f s — text=%s",
                elapsed,
                info.language,
                duration,
                full_text[:120],
            )

            return {
                "success": True,
                "text": full_text,
                "duration": round(duration, 2),
                "language": info.language or "ja",
            }

        except TimeoutError:
            elapsed = time.monotonic() - start
            logger.error("Transcription timed out after %.1f s", timeout_seconds)
            raise TimeoutError(f"Transcription timed out after {timeout_seconds:.0f} s")
        except Exception:
            elapsed = time.monotonic() - start
            logger.exception("Transcription failed after %.2f s", elapsed)
            raise


# ----------------------------------------------------------------------
# Module-level convenience accessor (initialised by app.py startup)
# ----------------------------------------------------------------------
_service: TranscriptionService | None = None


def get_service() -> TranscriptionService:
    global _service
    if _service is None:
        raise RuntimeError("TranscriptionService not initialised. Call initialise() first.")
    return _service


def initialise(model_size: str = "medium", device: str = "cuda", compute_type: str = "float16") -> TranscriptionService:
    global _service
    _service = TranscriptionService(model_size=model_size, device=device, compute_type=compute_type)
    _service.load_model()
    return _service
