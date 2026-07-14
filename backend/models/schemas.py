"""Pydantic schemas for API request/response validation."""

from typing import Literal

from pydantic import BaseModel, Field


class TranscribeResponse(BaseModel):
    """Standard response for the transcribe endpoint."""

    success: bool = Field(description="Whether the transcription succeeded")
    text: str = Field(default="", description="Transcribed Japanese text")
    duration: float = Field(default=0.0, description="Audio duration in seconds")
    language: str = Field(default="", description="Detected/used language code")
    error: str | None = Field(default=None, description="Error message if failed")


class HealthResponse(BaseModel):
    """Health-check response."""

    status: str = Field(description="Service status")
    gpu: str = Field(description="GPU or CPU device in use")
    model_loaded: bool = Field(description="Whether the model is loaded in memory")
    chat_ready: bool = Field(
        default=False,
        description="Whether the LLM chat service is initialised (requires OPENAI_API_KEY)",
    )
    tts_ready: bool = Field(
        default=False,
        description="Whether the VOICEVOX TTS service is reachable",
    )
    db_ready: bool = Field(
        default=False,
        description="Whether the MongoDB persistence layer is reachable",
    )


class ChatMessage(BaseModel):
    """A single turn in a roleplay conversation."""

    role: Literal["user", "model"] = Field(
        description="Who produced the turn: 'user' (caller) or 'model' (LLM)"
    )
    text: str = Field(min_length=1, max_length=2000, description="Turn content")


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    user_text: str = Field(
        min_length=1,
        max_length=2000,
        description="The Japanese text the user just said (from STT or typed)",
    )
    scenario: str = Field(
        default="",
        max_length=500,
        description="Roleplay scenario description (system-prompt context)",
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=50,
        description="Prior turns; the current user_text is added by the server",
    )


class ChatResponse(BaseModel):
    """Response body for POST /chat."""

    success: bool = Field(description="Whether the chat call succeeded")
    reply_jp: str = Field(default="", description="LLM reply in Japanese")
    reply_translation: str = Field(
        default="", description="Indonesian translation of reply_jp"
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Full conversation history including the new user + model turns",
    )
    error: str | None = Field(default=None, description="Error message if failed")


# ---------------------------------------------------------------------------
# TTS (VOICEVOX) schemas
# ---------------------------------------------------------------------------
class Speaker(BaseModel):
    """One (character, style) pair returned by VOICEVOX /speakers."""

    id: int = Field(description="VOICEVOX style_id (used as ?speaker= in /audio_query)")
    name: str = Field(description="Character name (e.g. '四国めたん')")
    style: str = Field(description="Style/variant name (e.g. 'ノーマル')")
    label: str = Field(description="UI label combining name and style")


class SpeakersResponse(BaseModel):
    """Response body for GET /speakers."""

    speakers: list[Speaker] = Field(
        default_factory=list,
        description="Flattened list of all (character, style) pairs",
    )


class TtsRequest(BaseModel):
    """Request body for POST /tts."""

    text: str = Field(
        min_length=1,
        max_length=2000,
        description="Japanese text to synthesise (e.g. the LLM's reply_jp)",
    )
    speaker: int | None = Field(
        default=None,
        description="VOICEVOX style_id; falls back to backend default if omitted",
    )


# ---------------------------------------------------------------------------
# Session persistence schemas
# ---------------------------------------------------------------------------
class SessionCreateRequest(BaseModel):
    """POST /sessions request body."""

    session_id: str = Field(
        min_length=1,
        max_length=64,
        description="Client-generated session UUID; idempotent on insert",
    )
    mode: Literal["transcribe", "roleplay"] = Field(
        default="roleplay", description="Application mode for this session"
    )
    scenario_id: str = Field(default="", description="Scenario identifier (preset or 'custom')")
    scenario_text: str | None = Field(default=None, description="Resolved scenario prompt")
    speaker_id: int | None = Field(default=None, description="VOICEVOX style_id at start")
    user_metadata: dict | None = Field(default=None, description="Optional client metadata")


class SessionTurn(BaseModel):
    """One completed exchange in the session."""

    turn: int = Field(ge=0, description="Monotonic turn index inside this session")
    ts: float = Field(description="Unix epoch seconds when the turn finished")
    user_text: str = Field(default="", description="Transcribed Japanese user utterance")
    language: str = Field(default="ja", description="Detected/forced language code")
    audio_duration_ms: int = Field(default=0, ge=0, description="Audio length in ms")
    ai_reply_jp: str | None = Field(default=None, description="LLM reply in Japanese")
    ai_reply_translation: str | None = Field(default=None, description="Indonesian translation")
    tts_speaker_id: int | None = Field(default=None, description="VOICEVOX style_id used for TTS")
    audio_blob_ref: str | None = Field(default=None, description="Opaque reference to stored audio")
    scenario_switched: bool = Field(default=False, description="True if user changed scenario mid-session")
    error: str | None = Field(default=None, description="Error from this turn, if any")


class SessionDoc(BaseModel):
    """A persisted roleplay/transcribe session."""

    session_id: str
    started_at: float = Field(description="Unix epoch seconds")
    ended_at: float | None = Field(default=None, description="Unix epoch seconds; null until close")
    mode: Literal["transcribe", "roleplay"] = "roleplay"
    scenario_id: str = ""
    scenario_text: str | None = None
    speaker_id: int | None = None
    messages: list[SessionTurn] = Field(default_factory=list)
    user_metadata: dict | None = None


class SessionPatchRequest(BaseModel):
    """PATCH /sessions/{id} body."""

    ended_at: float | None = None
    scenario_id: str | None = None
    scenario_text: str | None = None
    speaker_id: int | None = None
    user_metadata: dict | None = None


class SessionMessageResponse(BaseModel):
    """POST /sessions/{id}/messages response."""

    turn: int = Field(description="The assigned monotonic turn index")
