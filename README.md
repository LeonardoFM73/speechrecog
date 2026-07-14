# Japanese Speech-to-Text — Transcription, Roleplay & TTS

Modern web app for Japanese speech transcription, conversational practice, and text-to-speech using **Faster-Whisper Large-v3-Turbo** (local GPU) + **OpenAI-compatible LLM** (vLLM/qwen35-9b) + **VOICEVOX** (TTS) + **MongoDB** (session persistence).

Two modes in one page:
- **Transcribe** — Speak Japanese → instant transcription (Faster-Whisper)
- **Roleplay (Guru Jepang)** — Speak Japanese → STT → LLM roleplays a scenario → **TTS voice reply** via VOICEVOX → full conversation history saved to MongoDB

## Architecture

```
┌────────────────────┐   POST /transcribe (audio)    ┌──────────────────┐
│   Browser          │ ───────────────────────────►  │   FastAPI         │
│  (Next.js 15)      │                               │   + Faster-Whisper│
│  React/TS          │ ◄──── JSON transcription ──── │   (CUDA/int8)     │
│  • MediaRecorder   │                               └──────────────────┘
│  • Mode toggle     │
│  • Scenario/speaker│   POST /chat (text+history)     │
│  • Chat history    │ ───────────────────────────►  │   ChatService     │
│                    │                               │   (OpenAI-comp.)  │
│                    │ ◄──── JSON reply ────────────  │   qwen35-9b       │
└────────────────────┘                               └────────┬─────────┘
                                                             │
                                                   POST /tts   │
                                                   (audio wav) │
                                                             ▼
                                                    ┌──────────────────┐
                                                    │   VOICEVOX       │
                                                    │   Engine (LAN)   │
                                                    └──────────────────┘

                                                   Persistent sessions
                                                         ▼
                                                  ┌──────────────────┐
                                                  │   MongoDB (7)    │
                                                  │   /sessions CRUD │
                                                  └──────────────────┘
```

## Tech Stack

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS    |
| Backend  | FastAPI, Python 3.11+, loguru                    |
| STT      | Faster-Whisper (large-v3-turbo), CUDA int8       |
| LLM      | OpenAI-compatible endpoint (vLLM, qwen35-9b)     |
| TTS      | VOICEVOX Engine (WebSocket + CUDA onnxruntime-gpu)|
| Session  | MongoDB 7 (Motor async, conversation persistence)|
| GPU      | NVIDIA RTX 4050 6GB (CUDA 12+)                   |

## Project Structure

```
speechrecog/
├── backend/
│   ├── __init__.py
│   ├── app.py                    # FastAPI app, endpoints, lifespan
│   ├── requirements.txt          # Python dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py            # Pydantic schemas (all endpoints)
│   └── services/
│       ├── __init__.py
│       ├── transcriber.py        # TranscriptionService (Faster-Whisper)
│       ├── chat.py               # ChatService (OpenAI-compatible LLM)
│       ├── tts.py                # TtsService (VOICEVOX Engine)
│       └── sessions.py           # SessionService (MongoDB persistence)
├── frontend/
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   ├── public/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx              # Entry — renders MiguPage
│       ├── globals.css
│       ├── components/
│       │   ├── DurationBar.tsx       # Recording timer + waveform
│       │   ├── MicButton.tsx         # Record/Stop button
│       │   ├── ResultCard.tsx        # Transcription result display
│       │   ├── StatusIndicator.tsx   # Status badge + pulse
│       │   ├── ScenarioCard.tsx      # Scenario selection cards
│       │   ├── ScenarioPicker.tsx    # Roleplay scenario selector
│       │   ├── ChatHistory.tsx       # Conversation bubbles
│       │   ├── MiguPage.tsx          # Main page wrapper
│       │   ├── SpeakerPicker.tsx     # VOICEVOX speaker selector
│       │   ├── AudioPlayer.tsx       # Playback for TTS audio
│       │   ├── TalkingMigu.tsx       # Animated avatar component
│       │   ├── RoomBackground.tsx    # Scene background
│       │   ├── Avatar.tsx            # Avatar renderer
│       │   ├── SessionRoot.tsx       # Layout with session provider
│       │   ├── SessionControls.tsx   # Session management UI
│       │   ├── SessionProvider.tsx   # React context for sessions
│       │   └── avatars/              # Avatar sprite variants
│       ├── hooks/
│       │   ├── useMicrophone.ts      # MediaRecorder hook
│       │   ├── useAudioPlayback.ts   # Audio playback + wave
│       │   ├── useMiguReactions.ts   # Avatar reaction triggers
│       │   └── useSession.ts         # Session state hook
│       ├── services/
│       │   └── api.ts                  # API client (all endpoints)
│       └── types/
│           └── audio.ts                # TypeScript types + scenarios
├── *.yml / *.md
│   ├── docker-compose.yml          # Server deploy (backend+frontend+mongo)
│   ├── docker-compose.local.yml    # Local laptop deploy (frontend only)
│   ├── docker-compose.server.yml   # Server deploy variant
│   ├── Dockerfile.backend          # GPU backend image
│   ├── Dockerfile.frontend         # Static Next.js image
│   ├── Dockerfile.voicevox-cuda    # VOICEVOX Engine with CUDA ORT
│   ├── prep_pyopenjtalk.sh         # Build helper for pyopenjtalk
│   ├── Summary.md                  # Architecture narrative
│   └── README.md
└── docs/
    └── superpowers/
        ├── plans/                  # Implementation plans
        └── specs/                  # Design specs
```

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **NVIDIA GPU** with CUDA 12+ (RTX 4050 recommended)
- **VOICEVOX Engine** running on LAN (port 50021)
- **MongoDB 7** (local or containerised)
- OpenAI-compatible LLM server (e.g. vLLM)

### Option A: Docker Compose (recommended)

```bash
cd speechrecog

# Full stack — backend + frontend + MongoDB
# GPU mode (Faster-Whisper on CUDA):
docker compose --profile gpu up -d --build

# Or CPU-only:
docker compose up -d --build
```

After startup (~60s for model download + loading):

```bash
# Check services
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

Open [http://localhost:3000](http://localhost:3000)

Configure via `.env` — see [Configuration](#configuration) below.

### Option B: Manual Setup

#### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

#### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

#### 3. VOICEVOX Engine

Run VOICEVOX on your LAN or server. Configure `VOICEVOX_URL` in `.env`.

#### 4. MongoDB

Ensure MongoDB is reachable. Configure `MONGODB_URL` in `.env`.

---

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
cp .env.example .env
```

| Variable                | Default                     | Description                                           |
|-------------------------|-----------------------------|-------------------------------------------------------|
| `BACKEND_PORT`          | `8000`                      | Host port for backend container                        |
| `FRONTEND_PORT`         | `3000`                      | Host port for frontend                                 |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:8000`     | Backend URL reachable from the browser                 |
| `OPENAI_BASE_URL`       | `http://10.100.101.12:5091/v1` | OpenAI-compatible LLM endpoint (required for /chat)|
| `OPENAI_API_KEY`        | `EMPTY`                     | API key for the LLM endpoint                           |
| `OPENAI_MODEL`          | `qwen35-9b`                 | Model name to use with the LLM endpoint                |
| `VOICEVOX_URL`          | `http://localhost:50021`    | VOICEVOX Engine URL (required for /tts)                |
| `VOICEVOX_DEFAULT_SPEAKER` | `2`                     | Default VOICEVOX speaker style_id (0=normal, 1=sweet, …) |
| `VOICEVOX_PORT`         | `50021`                     | Host port for VOICEVOX container                       |
| `MONGODB_URL`           | `mongodb://mongo:27017`     | MongoDB connection string                              |
| `MONGODB_DB`            | `speechrecog`               | MongoDB database name                                  |

---

## API Reference

### `GET /health`

Check service health and component status.

**Response:**
```json
{
  "status": "ok",
  "gpu": "cuda",
  "model_loaded": true,
  "chat_ready": true,
  "tts_ready": true,
  "db_ready": true
}
```

| Field           | Description                                          |
|-----------------|------------------------------------------------------|
| `chat_ready`    | `true` if `OPENAI_BASE_URL` is set and LLM reachable |
| `tts_ready`     | `true` if VOICEVOX engine is reachable               |
| `db_ready`      | `true` if MongoDB connection succeeds                |

### `POST /transcribe`

Transcribe an audio file.

**Content-Type:** `multipart/form-data`

| Field   | Type   | Required | Description                        |
|---------|--------|----------|------------------------------------|
| `audio` | File   | Yes      | Audio file (webm/wav/ogg, ≤20 MB)  |

**Success Response (200):**
```json
{
  "success": true,
  "text": "こんにちは。私の名前はレオナルドです。",
  "duration": 4.5,
  "language": "ja",
  "error": null
}
```

**Error Responses:**
| Status | Meaning                              |
|--------|--------------------------------------|
| 400    | Empty file or wrong content type     |
| 413    | File too large (>20 MB)              |
| 503    | Model not loaded                     |
| 504    | Transcription timeout (>30s)         |

### `POST /chat`

Send user text (in Japanese) plus scenario and history, get a Japanese reply with Indonesian translation.

Requires `OPENAI_BASE_URL` and `OPENAI_API_KEY` (otherwise returns 503).

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "user_text": "駅までお願いします",
  "scenario": "あなたは東京でタクシーの運転手です。ユーザーが今、駅でタクシーを探しています。",
  "history": [
    {"role": "user", "text": "すみません、タクシーは空いていますか"},
    {"role": "model", "text": "はい、どうぞお乗りください"}
  ]
}
```

| Field       | Type             | Required | Constraints        | Description                                |
|-------------|------------------|----------|--------------------|--------------------------------------------|
| `user_text` | string           | yes      | 1–2000 chars       | The Japanese text the user just said       |
| `scenario`  | string           | no       | ≤500 chars         | System-prompt context (roleplay setting)   |
| `history`   | `ChatMessage[]`  | no       | ≤50 turns          | Prior turns                                |

**Success Response (200):**
```json
{
  "success": true,
  "reply_jp": "かしこまりました。どこまで行かれますか?",
  "reply_translation": "Baik, mau ke mana?",
  "history": [
    {"role": "user",  "text": "すみません、タクシーは空いていますか"},
    {"role": "model", "text": "はい、どうぞお乗りください"},
    {"role": "user",  "text": "駅までお願いします"},
    {"role": "model", "text": "かしこまりました。どこまで行かれますか?"}
  ],
  "error": null
}
```

**Error Responses:**
| Status | Meaning                                                     |
|--------|-------------------------------------------------------------|
| 400    | Empty `user_text` or malformed scenario                     |
| 422    | Validation failed (e.g. >50 turns, too-long text)           |
| 502    | LLM provider error (network / API failure)                  |
| 503    | Chat service not initialised (`OPENAI_BASE_URL` missing)    |

The server truncates `history` to the last **10 turns** before sending to the LLM.

### `GET /speakers`

Return all available VOICEVOX speakers.

**Success Response (200):**
```json
{
  "speakers": [
    {"id": 1, "name": "四国めたん", "style": "ノーマル", "label": "四国めたん — ノーマル"},
    {"id": 2, "name": "四国めたん", "style": "あまあま", "label": "四国めたん — あまあま"},
    {"id": 3, "name": "ずんだもん", "style": "ノーマル", "label": "ずんだもん — ノーマル"}
  ]
}
```

### `POST /tts`

Synthesise Japanese text → WAV audio stream via VOICEVOX.

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "text": "かしこまりました。どこまで行かれますか?",
  "speaker": 2
}
```

| Field      | Type   | Required | Description                                    |
|------------|--------|----------|------------------------------------------------|
| `text`     | string | yes      | Japanese text to synthesise (1–2000 chars)     |
| `speaker`  | int    | no       | VOICEVOX style_id; falls back to default       |

**Success Response (200):** `audio/wav` — 24 kHz PCM WAV bytes.

**Error Responses:**
| Status | Meaning                                   |
|--------|-------------------------------------------|
| 400    | Empty text                                |
| 502    | VOICEVOX engine error                     |
| 503    | TTS service not ready                     |

### Session Persistence (`/sessions`)

All roleplay/transcribe sessions are persisted to MongoDB.

| Method | Path                          | Description                         |
|--------|-------------------------------|-------------------------------------|
| `POST` | `/sessions`                   | Create or get existing session      |
| `GET`  | `/sessions/{session_id}`      | Retrieve full session document      |
| `PATCH`| `/sessions/{session_id}`      | Update session fields (scenario, etc.)|
| `POST` | `/sessions/{session_id}/messages` | Append a new turn to the session |

**Session Document:**
```json
{
  "session_id": "abc-123",
  "started_at": 1720000000.0,
  "ended_at": null,
  "mode": "roleplay",
  "scenario_id": "taxi_station",
  "scenario_text": "あなたは東京でタクシーの運転手です…",
  "speaker_id": 2,
  "messages": [
    {
      "turn": 0,
      "ts": 1720000010.0,
      "user_text": "すみません、タクシーは空いていますか",
      "language": "ja",
      "audio_duration_ms": 3200,
      "ai_reply_jp": "はい、どうぞお乗りください",
      "ai_reply_translation": "Ya, silakan masuk.",
      "tts_speaker_id": 2,
      "audio_blob_ref": null,
      "scenario_switched": false,
      "error": null
    }
  ],
  "user_metadata": {}
}
```

---

## Features

### Frontend
- **Recording timer** — live seconds counter with waveform animation
- **Mode toggle** — switch between Transcribe-only and Roleplay
- **Scenario picker** — preset scenarios (taxi, konbini, restaurant, etc.) + custom input
- **Speaker picker** — choose VOICEVOX character/style for TTS replies
- **Chat history** — scrollable conversation bubbles with Indonesian translations
- **TTS audio playback** — listen to LLM replies in Japanese voice
- **Animated avatar** — reactive character sprite (TalkingMigu) during conversations
- **Session persistence** — conversations survive page refresh (MongoDB)
- **Status indicator** — Idle, Recording, Uploading, Transcribing, Chatting, TTS Playing, Complete, Error
- **Responsive design** — works on mobile and desktop
- **Error handling** — permission denied, empty recording, network errors, LLM/TTS unavailable

### Backend
- **Model caching** — Faster-Whisper loads once, stays in memory
- **CUDA detection** — auto-detects GPU; falls back to CPU automatically
- **VAD filtering** — silences filtered during transcription
- **Structured logging** — startup, transcription time, file size, errors
- **Multiple services** — STT, LLM, TTS, session persistence — all independently degraded on failure
- **Session persistence** — full conversation history stored in MongoDB

---

## Docker Architecture

```
┌──────────────────────┐
│  Browser             │
│  localhost:3000      │
└──────────┬───────────┘
           │
   ┌───────▼────────┐
   │  Frontend      │
   │  Next.js (ALPIN)│
   └───────┬────────┘
           │ /api/* → http://backend:8000/*
   ┌───────▼────────┐
   │  Backend       │◄── NVIDIA GPU (CUDA)
   │  FastAPI       │◄── VOICEVOX (LAN)
   │  :8000         │◄── MongoDB (:27017)
   └───────┬────────┘
           │
   ┌───────▼────────┐
   │  MongoDB 7     │
   │  :27017        │
   └────────────────┘
```

NOTE: VOICEVOX runs as a separate service (not in this compose file) on a LAN host. The backend proxies TTS requests to it.

---

## Performance

| Metric              | Target    | Typical (RTX 4050) |
|---------------------|-----------|---------------------|
| Model load time     | <60s      | ~45s (first run)    |
| 5s audio → result   | <3s       | ~1.5-2.5s          |
| 15s audio → result  | <5s       | ~3-4s              |
| Memory usage (GPU)  | <4GB      | ~3-4 GB             |
| TTS synth time      | <2s       | ~0.5-1.5s          |

---

## Troubleshooting

### "GPU not available"

```bash
nvidia-smi
python3 -c "import torch; print(torch.cuda.is_available())"
```

### "Model failed to load"

The app auto-fallbacks to CPU. Check logs:
```bash
sudo journalctl -u stt-backend -f
```

### "TTS service disabled"

- Ensure VOICEVOX Engine is running and reachable at `VOICEVOX_URL`
- Default expects VOICEVOX on `localhost:50021` inside the backend container
- Adjust in `.env` → `VOICEVOX_URL=http://<lan-host-ip>:50021`

### "Chat service disabled"

- Ensure `OPENAI_BASE_URL` and `OPENAI_API_KEY` are set
- Verify connectivity: `curl $OPENAI_BASE_URL/v1/models`
- Models that support `response_format: {type: json_object}` work best

### "MongoDB unreachable"

- Ensure MongoDB is running and reachable at `MONGODB_URL`
- Session persistence returns 503 if DB is down, but transcription/LLM/TTS still work

### "Microphone permission denied"

- HTTPS required in production (localhost HTTP works for dev)
- Check browser settings → site permissions → microphone

---

## Deployment Notes

### Server (Ubuntu + GPU)

1. `docker compose --profile gpu up -d --build` — deploys backend + frontend + MongoDB
2. VOICEVOX runs separately on LAN; set `VOICEVOX_URL` in `.env` to reach it
3. OpenAI-compatible LLM runs on separate host; set `OPENAI_BASE_URL` in `.env`

### Local Laptop

Use `docker-compose.local.yml` — starts only the frontend, browser reaches backend over LAN:

```bash
docker compose -f docker-compose.local.yml up -d
```

---

## License

MIT
