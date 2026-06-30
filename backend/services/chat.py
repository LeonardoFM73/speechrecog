"""Chat service — LLM-powered Japanese conversation partner.

Singleton pattern, parallel to services/transcriber.py.
Provider: Google Gemini (default). GEMINI_API_KEY must be set in env.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Literal

from google import genai

logger = logging.getLogger(__name__)

ProviderName = Literal["gemini"]


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT_TEMPLATE = """\
あなたは日本語の会話パートナーです。

# 状況 / シナリオ
{scenario}

# ルール
- 必ず日本語で返答してください (自然な会話、N3 レベル目安)
- 返答は1〜3文にしてください
- 最後に「ユーザーへの確認質問」を1つ入れて、会話を続けてください
- 翻訳 (translation) はインドネシア語で1文、提供してください
- 必ず以下のJSON形式で出力してください:
  {{"reply_jp": "<日本語の返答>", "reply_translation": "<インドネシア語の翻訳>"}}

# 会話履歴
{history_text}
"""

DEFAULT_SCENARIO = (
    "あなたは東京でタクシーの運転手です。"
    "ユーザーが今、主要な駅でタクシーを探しています。"
)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class ChatService:
    """Wraps a single Gemini client. Initialised once at app startup."""

    _instance: "ChatService | None" = None
    _client: genai.Client | None = None
    _model: str = "gemini-2.5-flash"

    def __init__(self) -> None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY env var is not set — chat service cannot start"
            )
        self._client = genai.Client(api_key=api_key)
        logger.info("ChatService initialised with Gemini model=%s", self._model)

    # ------------------------------------------------------------------
    @classmethod
    def initialise(cls) -> "ChatService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def get_service(cls) -> "ChatService":
        if cls._instance is None:
            raise RuntimeError("ChatService not initialised. Call initialise() first.")
        return cls._instance

    # ------------------------------------------------------------------
    @property
    def is_loaded(self) -> bool:
        return self._client is not None

    # ------------------------------------------------------------------
    def chat(
        self,
        user_text: str,
        scenario: str,
        history: list[dict],
    ) -> dict[str, str]:
        """Send user text + scenario + history to Gemini, return parsed reply.

        Args:
            user_text: What the user just said (in Japanese).
            scenario: System-prompt scenario description.
            history: Prior turns, list of {"role": "user"|"model", "text": "..."}.
                     The current user_text should NOT be in history (it is added
                     by the endpoint).

        Returns:
            {"reply_jp": str, "reply_translation": str}
        """
        if self._client is None:
            raise RuntimeError("ChatService client not initialised")

        if not user_text or not user_text.strip():
            raise ValueError("user_text is empty")

        # Truncate to last 10 turns to bound token cost.
        history_text = "\n".join(
            f"{'User' if m['role'] == 'user' else 'You'}: {m['text']}"
            for m in history[-10:]
        ) or "(no prior messages)"

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            scenario=(scenario or "").strip() or DEFAULT_SCENARIO,
            history_text=history_text,
        )

        logger.info(
            "Chat request: scenario_len=%d history_turns=%d user_chars=%d",
            len(scenario or ""),
            min(len(history), 10),
            len(user_text),
        )

        response = self._client.models.generate_content(
            model=self._model,
            contents=user_text,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.7,
                "response_mime_type": "application/json",
            },
        )

        raw: str = response.text or ""
        parsed: dict[str, Any] = self._parse_json(raw)

        return {
            "reply_jp": str(parsed.get("reply_jp", "")).strip(),
            "reply_translation": str(parsed.get("reply_translation", "")).strip(),
        }

    # ------------------------------------------------------------------
    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any]:
        """Parse LLM JSON output, tolerating ```json code-fence wrappers."""
        text = raw.strip()
        # Strip common code fences
        for fence in ("```json", "```JSON", "```"):
            if text.startswith(fence):
                text = text[len(fence):]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse LLM JSON: %s\nRaw: %s", exc, raw[:500])
            raise ValueError(f"LLM returned malformed JSON: {exc}") from exc

        if not isinstance(data, dict):
            raise ValueError(f"LLM JSON is not an object: {type(data).__name__}")
        return data


# ---------------------------------------------------------------------------
# Module-level convenience accessor (initialised by app.py startup)
# ---------------------------------------------------------------------------
_chat_service: ChatService | None = None


def get_service() -> ChatService:
    """Return the singleton ChatService. Raises if not initialised."""
    global _chat_service
    if _chat_service is None:
        raise RuntimeError("ChatService not initialised. Call initialise() first.")
    return _chat_service


def is_ready() -> bool:
    """True if the chat service was successfully initialised."""
    return _chat_service is not None and _chat_service.is_loaded


def initialise() -> ChatService:
    """Create the singleton (idempotent). Raises if GEMINI_API_KEY is missing."""
    global _chat_service
    if _chat_service is not None:
        return _chat_service
    _chat_service = ChatService.initialise()
    return _chat_service
