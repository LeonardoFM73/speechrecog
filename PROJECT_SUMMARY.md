# Japanese Speech-to-Text & Roleplay Platform

Web app for Japanese transcription, conversational practice, and TTS.

## Quick Overview

- **Frontend:** Next.js 15 + React 19 + TypeScript + TailwindCSS
- **Backend:** FastAPI (Python) with modular services
- **STT:** Faster-Whisper large-v3-turbo (CUDA int8)
- **LLM:** OpenAI-compatible (vLLM serving qwen38-27b)
- **TTS:** VOICEVOX Engine
- **DB:** MongoDB (session/conversation persistence)

## Two Modes

1. **Transcribe** — Speak Japanese → instant transcription
2. **Roleplay (Guru Jepang)** — Speak → STT → LLM roleplays scenario → TTS voice reply → history saved

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/transcribe` | Audio → Japanese text |
| POST | `/chat` | Text + scenario + history → LLM reply |
| POST | `/tts` | Japanese text → WAV audio |
| GET | `/speakers` | VOICEVOX speaker list |
| GET | `/health` | System status (GPU/model/chat/TTS/DB) |
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login → JWT token |
| GET | `/auth/me` | Current user info |
| GET/POST/DELETE | `/admin/users/*` | Admin user management |

## Running Locally

```bash
# Full stack (frontend + backend + all services)
docker compose up -d

# Frontend only (connects to remote backend)
docker compose -f docker-compose.local.yml up -d
```

## Environment Variables

See `.env.example` for full list. Key vars:
- `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`
- `VOICEVOX_URL` / `VOICEVOX_DEFAULT_SPEAKER`
- `MONGODB_URL` / `MONGODB_DB`

## Authentication & Admin

- **JWT-based auth** with `localStorage` token storage
- **Role system:** `admin` / `user`
- **Admin panel** (`/admin`): user management, scenario CRUD, session history viewer
- **Admin API:**
  - `GET /admin/users` — list all users
  - `POST /admin/users/{username}/role` — update role
  - `DELETE /admin/users/{username}` — delete user
  - `GET /admin/scenarios` — list scenarios (admin only)
  - `GET /admin/sessions` — list all sessions (admin only)
- **SSO support** for LMS integration

## Recent Bug Fixes (Sep 2026)

See `BUGFIX_SUMMARY.md` for details.

| Issue | Fix |
|-------|-----|
| React #31 — object rendered as child | Added `ErrorBoundary`, role normalization, data sanitization |
| 403 from `/auth/me` | Normalize "guru" and other roles to "user" in AuthContext |
| 500 on PATCH session | Restored missing `get_session_owned()` in sessions.py |
| Hydration mismatch on /admin | Added `authLoaded` guard before rendering admin panel |

## Architecture

```
Browser → FastAPI → [STT | Chat/LLM | TTS] → MongoDB (sessions)
                ↓
         JWT Auth + Admin API
```

Services are independent — each degrades gracefully if its dependency is unavailable.
