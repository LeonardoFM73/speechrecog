"""Chat service — LLM-powered Japanese conversation partner.

Singleton pattern, parallel to services/transcriber.py.
Provider: any OpenAI-compatible chat-completions endpoint (e.g. vLLM).
Configured via OPENAI_BASE_URL and OPENAI_API_KEY.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


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
    """Thin async wrapper around an OpenAI-compatible chat-completions endpoint."""

    _instance: "ChatService | None" = None
    _client: httpx.AsyncClient | None = None
    _model: str = "qwen35-9b"

    def __init__(self) -> None:
        self._base_url = os.environ.get(
            "OPENAI_BASE_URL", "http://10.100.101.12:5091/v1"
        ).rstrip("/")
        self._api_key = os.environ.get("OPENAI_API_KEY", "EMPTY").strip() or "EMPTY"
        self._model = os.environ.get("OPENAI_MODEL", self._model).strip()
        timeout = float(os.environ.get("OPENAI_TIMEOUT", "60"))
        self._client = httpx.AsyncClient(timeout=timeout)
        logger.info(
            "ChatService initialised base_url=%s model=%s",
            self._base_url,
            self._model,
        )

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

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    async def chat(
        self,
        user_text: str,
        scenario: str,
        history: list[dict],
    ) -> dict[str, str]:
        """Send user text + scenario + history to the LLM, return parsed reply.

        Args:
            user_text: What the user just said (in Japanese).
            scenario: System-prompt scenario description.
            history: Prior turns, list of {"role": "user"|"assistant", "text": "..."}.
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
            f"{'User' if m.role == 'user' else 'You'}: {m.text}"
            for m in history[-10:]
        ) or "(no prior messages)"

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            scenario=(scenario or "").strip() or DEFAULT_SCENARIO,
            history_text=history_text,
        )

        # OpenAI-compatible: system goes as a system message; user turn appended.
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for m in history[-10:]:
            role = "assistant" if m.role == "model" else "user"
            messages.append({"role": role, "content": m.text})
        messages.append({"role": "user", "content": user_text})

        logger.info(
            "Chat request: scenario_len=%d history_turns=%d user_chars=%d",
            len(scenario or ""),
            min(len(history), 10),
            len(user_text),
        )

        try:
            resp = await self._client.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": messages,
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("LLM HTTP error: %s", exc)
            raise

        data = resp.json()
        raw: str = ""
        try:
            raw = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            logger.error("Unexpected LLM response shape: %s\nPayload: %s", exc, data)
            raise ValueError(f"Unexpected LLM response shape: {exc}") from exc

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
    """Create the singleton (idempotent)."""
    global _chat_service
    if _chat_service is not None:
        return _chat_service
    _chat_service = ChatService.initialise()
    return _chat_service


async def aclose() -> None:
    """Close the underlying HTTP client. Idempotent."""
    global _chat_service
    if _chat_service is not None:
        await _chat_service.aclose()
        _chat_service = None