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
    jp_level: Literal["n5", "n4", "n3", "n2", "n1"] = Field(
        default="n3", description="Japanese difficulty level for the LLM"
    )
    max_turns: int = Field(
        default=10, ge=2, le=100,
        description="Conversation turn limit; AI will suggest ending near this count",
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


class KaiwaChatRequest(BaseModel):
    """Request body for POST /kaiwa/chat."""

    user_text: str = Field(
        min_length=1,
        max_length=2000,
        description="The Japanese text the user just said (from STT or typed)",
    )
    scenario_id: str = Field(
        min_length=1,
        description="Scenario identifier (must be kind='kaiwa')",
    )
    question_id: str = Field(
        min_length=1,
        description="Question ID from the scenario's kind_config.questions",
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=50,
        description="Prior turns; the current user_text is added by the server",
    )
    jp_level: Literal["n5", "n4", "n3", "n2", "n1"] = Field(
        default="n3", description="Japanese difficulty level for the LLM"
    )
    max_turns: int = Field(
        default=10, ge=2, le=100,
        description="Conversation turn limit; AI will suggest ending near this count",
    )


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
    speed: float | None = Field(
        default=None,
        ge=0.5,
        le=2.0,
        description="Speed multiplier override; falls back to session default if omitted",
    )


# ---------------------------------------------------------------------------
# Session persistence schemas
# ---------------------------------------------------------------------------
class UserCreateRequest(BaseModel):
    """POST /auth/register request body."""

    username: str = Field(min_length=3, max_length=32, description="Unique username")
    password: str = Field(min_length=6, max_length=128, description="Password")


class LoginRequest(BaseModel):
    """POST /auth/login request body."""

    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """POST /auth/login /auth/register response."""

    access_token: str = Field(description="JWT token")
    token_type: str = Field(default="bearer")
    username: str = Field(description="Authenticated username")
    role: str = Field(description="User role (user/admin)")


class RoleUpdateRequest(BaseModel):
    """POST /admin/users/{username}/role request body."""

    role: Literal["user", "admin"]


class SessionCreateRequest(BaseModel):
    """POST /sessions request body."""

    session_id: str = Field(
        min_length=1,
        max_length=64,
        description="Client-generated session UUID; idempotent on insert",
    )
    mode: Literal["transcribe", "roleplay", "kaiwa"] = Field(
        default="roleplay", description="Application mode for this session"
    )
    scenario_id: str = Field(default="", description="Scenario identifier (preset or 'custom')")
    scenario_text: str | None = Field(default=None, description="Resolved scenario prompt")
    speaker_id: int | None = Field(default=None, description="VOICEVOX style_id at start")
    tts_speed: float = Field(default=1.0, ge=0.5, le=2.0, description="TTS speed multiplier")
    jp_level: Literal["n5", "n4", "n3", "n2", "n1"] = Field(
        default="n3", description="Japanese difficulty level"
    )
    max_turns: int = Field(default=10, ge=2, le=100, description="Max conversation turns before natural end")
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
    username: str = Field(description="Owner of this session")
    started_at: float = Field(description="Unix epoch seconds")
    ended_at: float | None = Field(default=None, description="Unix epoch seconds; null until close")
    mode: Literal["transcribe", "roleplay"] = "roleplay"
    scenario_id: str = ""
    scenario_text: str | None = None
    speaker_id: int | None = None
    tts_speed: float = 1.0
    jp_level: Literal["n5", "n4", "n3", "n2", "n1"] = "n3"
    max_turns: int = 10
    messages: list[SessionTurn] = Field(default_factory=list)
    user_metadata: dict | None = None


class SessionPatchRequest(BaseModel):
    """PATCH /sessions/{id} body."""

    ended_at: float | None = None
    scenario_id: str | None = None
    scenario_text: str | None = None
    speaker_id: int | None = None
    tts_speed: float | None = None
    jp_level: Literal["n5", "n4", "n3", "n2", "n1"] | None = None
    max_turns: int | None = None
    user_metadata: dict | None = None


class SessionMessageResponse(BaseModel):
    """POST /sessions/{id}/messages response."""

    turn: int = Field(description="The assigned monotonic turn index")


# ---------------------------------------------------------------------------
# Scenario management schemas
# ---------------------------------------------------------------------------
class KaiwaQuestion(BaseModel):
    """One练习 (practice) question in a Kaiwa Renshuu scenario."""

    id: str = Field(description="Unique question ID within the scenario")
    question: str = Field(min_length=1, description="Question text in Indonesian")
    topic_hint: str = Field(default="", description="Japanese topic context for LLM")


class ScenarioKindConfig(BaseModel):
    """Kaiwa-specific configuration (questions list)."""

    questions: list[KaiwaQuestion] = Field(default_factory=list)


class ScenarioDoc(BaseModel):
    """Persisted scenario document."""

    scenario_id: str = Field(description="Unique slug identifier")
    kind: Literal["roleplay", "kaiwa"] = Field(description="Scenario type")
    label: str = Field(description="UI display name")
    emoji: str = Field(default="", description="Emoji icon")
    description: str = Field(description="System prompt context (Japanese)")
    is_preset: bool = Field(default=False, description="True for seeded presets")
    created_by: str | None = Field(default=None, description="Admin username who created it")
    created_at: float = Field(description="Unix epoch seconds")
    updated_at: float = Field(description="Unix epoch seconds")
    kind_config: ScenarioKindConfig = Field(default_factory=ScenarioKindConfig)


class ScenarioCreateRequest(BaseModel):
    """POST /admin/scenarios request body."""

    kind: Literal["roleplay", "kaiwa"]
    label: str = Field(min_length=1, max_length=200)
    emoji: str = Field(default="", max_length=10)
    description: str = Field(min_length=1, max_length=2000)
    kind_config: ScenarioKindConfig = Field(default_factory=ScenarioKindConfig)


class ScenarioUpdateRequest(BaseModel):
    """PATCH /admin/scenarios/{id} request body."""

    label: str | None = None
    emoji: str | None = None
    description: str | None = None
    kind_config: ScenarioKindConfig | None = None
