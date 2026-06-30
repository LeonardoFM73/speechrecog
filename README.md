# 日本語音声認識 — Japanese Speech-to-Text & Roleplay

Modern web app for Japanese speech transcription and conversational practice using **Faster-Whisper Medium** (local GPU) + **Google Gemini LLM** (cloud).

Two modes in one page:
- **Transcribe** — Speak Japanese → instant transcription (Faster-Whisper)
- **Roleplay (Guru Jepang)** — Speak Japanese → STT → Gemini roleplays a scenario (e.g. "you are a taxi driver at Tokyo station") → replies in Japanese + Indonesian translation

## Architecture

```
┌────────────────────┐   POST /transcribe (audio)    ┌──────────────────┐
│   Browser          │ ───────────────────────────►  │   FastAPI         │
│  (Next.js 15)      │                               │   + Faster-Whisper│
│  React/TS          │ ◄──── JSON transcription ──── │   (CUDA/float16)  │
│  • MediaRecorder   │                               └──────────────────┘
│  • Mode toggle     │
│  • Scenario picker │   POST /chat (text+history)    ┌──────────────────┐
│  • Chat history    │ ───────────────────────────►  │   ChatService     │
│                    │                               │   (Google Gemini) │
│                    │ ◄──── JSON reply ────────────  │   gemini-2.5-flash│
└────────────────────┘                               └──────────────────┘
                                                                  │
                                                                  ▼
                                                       Google Gemini API
                                                       (HTTPS, JSON mode)
```

## Tech Stack

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS    |
| Backend  | FastAPI, Python 3.11+                            |
| STT      | Faster-Whisper (medium), CUDA float16            |
| LLM      | Google Gemini 2.5 Flash (via `google-genai` SDK) |
| GPU      | NVIDIA RTX 4050 6GB                              |

## Project Structure

```
speechrecog/
├── backend/
│   ├── __init__.py
│   ├── app.py                    # FastAPI app, endpoints, lifespan
│   ├── requirements.txt          # Python dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py            # Pydantic response schemas (incl. ChatRequest/Response)
│   └── services/
│       ├── __init__.py
│       ├── transcriber.py        # TranscriptionService (singleton, Faster-Whisper)
│       └── chat.py               # ChatService (singleton, Google Gemini)
├── frontend/
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   ├── public/
│   └── app/
│       ├── layout.tsx                # Root layout with metadata
│       ├── page.tsx                  # Main page: mode toggle + transcribe/roleplay flow
│       ├── globals.css               # Tailwind + custom CSS
│       ├── components/
│       │   ├── DurationBar.tsx       # Recording timer + waveform
│       │   ├── MicButton.tsx         # Record/Stop button
│       │   ├── ResultCard.tsx        # Transcription result display
│       │   ├── StatusIndicator.tsx   # Status badge + pulse
│       │   ├── ScenarioPicker.tsx    # Roleplay scenario selector
│       │   └── ChatHistory.tsx       # Roleplay conversation bubbles
│       ├── hooks/
│       │   └── useMicrophone.ts      # MediaRecorder hook
│       ├── services/
│       │   └── api.ts                  # API client (transcription + chat)
│       └── types/
│           └── audio.ts                # TypeScript types + PRESET_SCENARIOS
├── Summary.md                    # Program flow / architecture narrative
└── README.md
```

---

## Quick Start

### Prerequisites

- **Python 3.11+** (3.14 tested)
- **Node.js 18+** (v24 tested)
- **NVIDIA GPU** with CUDA 12+ (RTX 4050 recommended)
- NVIDIA drivers installed

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Expected output:
```
2026-06-14 20:30:00 [INFO] CUDA available: True → device=cuda
2026-06-14 20:30:00 [INFO] Loading Faster-Whisper model=medium device=cuda compute=float16
2026-06-14 20:30:45 [INFO] Model loaded successfully in 45.12 s
2026-06-14 20:30:45 [INFO] FastAPI application started — device=cuda
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Test Microphone

1. Click the **mic button** on the web page
2. **Allow** microphone permission when the browser asks
3. Click again and **speak Japanese** (e.g. "こんにちは")
4. Click the button again to **stop**
5. Watch the transcription appear within 1-3 seconds

### 4. Roleplay Mode

1. Open the app and click the **Roleplay (Guru Jepang)** toggle
2. **Pick a scenario** from the dropdown (or write a custom one)
3. Click the mic, **speak Japanese**, stop, then wait:
   - Transcription appears (same STT pipeline)
   - Gemini roleplays back in Japanese + Indonesian translation
4. Repeat to continue the conversation — the full chat history is preserved
5. Press **Clear conversation** to start a new session

**Prerequisite:** set `GEMINI_API_KEY` (get one at https://aistudio.google.com/apikey) in your `.env` file.

---

## API Reference

### `GET /health`

Check service health and GPU status.

**Response:**
```json
{
  "status": "ok",
  "gpu": "cuda",
  "model_loaded": true,
  "chat_ready": true
}
```

`chat_ready` is `true` only when `GEMINI_API_KEY` is set and the Gemini client initialised successfully.

### `POST /transcribe`

Transcribe an audio file.

**Content-Type:** `multipart/form-data`

**Form Field:**
| Field  | Type   | Required | Description    |
|--------|--------|----------|----------------|
| `audio` | File  | Yes      | Audio file (webm/wav/ogg, ≤20 MB) |

**Success Response (200):**
```json
{
  "success": true,
  "text": "こんにちは。私の名前はレオナルドです。",
  "duration": 4.5,
  "language": "ja"
}
```

**Error Responses:**
| Status | Meaning                              |
|--------|--------------------------------------|
| 400    | Empty file or wrong content type     |
| 401    | Microphone not granted               |
| 413    | File too large (>20 MB)              |
| 500    | Transcription error                  |
| 503    | Model not loaded                     |
| 504    | Transcription timeout (>30s)         |

### `POST /chat`

Send a user turn (in Japanese) plus a scenario and history, get a Japanese reply with Indonesian translation. Used by the **Roleplay** mode after STT has produced the user's text.

Requires `GEMINI_API_KEY` to be set on the backend (otherwise returns 503).

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

| Field      | Type             | Required | Constraints        | Description                                |
|------------|------------------|----------|--------------------|--------------------------------------------|
| `user_text`| string           | yes      | 1–2000 chars       | The Japanese text the user just said       |
| `scenario` | string           | no       | ≤500 chars         | System-prompt context (roleplay setting)   |
| `history`  | `ChatMessage[]`  | no       | ≤50 turns          | Prior turns; the current `user_text` is appended by the server |

`ChatMessage` shape: `{"role": "user" | "model", "text": "..."}`

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
| 422    | Validation failed (e.g. >50 history turns, too-long text)   |
| 502    | LLM provider error (network / API failure)                  |
| 503    | Chat service not initialised (`GEMINI_API_KEY` missing)     |

The server truncates `history` to the last **10 turns** before sending to Gemini, to bound token cost.

---

## Features

### Frontend
- **Recording timer** — live seconds counter with waveform animation
- **Mode toggle** — switch between Transcribe-only and Roleplay (STT + LLM)
- **Scenario picker** — 5 presets (taxi station, konbini, restaurant, train ticket, doctor) + custom input
- **Chat history** — scrollable conversation bubbles with Indonesian translations
- **Status indicator** — Idle, Recording, Uploading, Transcribing, Chatting, Complete, Error
- **Responsive design** — works on mobile and desktop
- **Error handling** — permission denied, empty recording, network errors, LLM unavailable

### Backend
- **Model caching** — Faster-Whisper loads once, stays in memory
- **CUDA detection** — auto-detects GPU; falls back to CPU automatically
- **VAD filtering** — silences are filtered during transcription
- **Structured logging** — startup, transcription time, file size, errors

---

## Deployment on Ubuntu (RTX 4050)

### 1. System Setup

```bash
# Install NVIDIA drivers
sudo ubuntu-drivers install
sudo reboot

# Verify GPU
nvidia-smi

# Install Python 3.11+
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone & Setup

```bash
cd /opt/speechrecog
git clone <your-repo-url> .

# Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Verify GPU with Faster-Whisper

```bash
cd backend
source venv/bin/activate
python3 -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'CUDA device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')
print(f'CUDA device memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
"
```

Expected:
```
PyTorch version: 2.5.1+cu124
CUDA available: True
CUDA device: NVIDIA GeForce RTX 4050 Laptop GPU
CUDA device memory: 6.0 GB
```

### 4. Ensure float16 is Enabled

In `backend/services/transcriber.py` the model loads with:
```python
device="cuda", compute_type="float16"
```

`float16` requires:
- GPU with **Compute Capability ≥ 7.5** (RTX 4050 = Ada Lovelace = 8.9 ✓)
- CUDA toolkit 12+ (your system has 13.0 ✓)

### 5. Systemd Service (Backend)

```bash
sudo tee /etc/systemd/system/stt-backend.service > /dev/null << 'EOF'
[Unit]
Description=Japanese STT Backend (Faster-Whisper)
After=network.target

[Service]
Type=simple
User=leonardofm
WorkingDirectory=/opt/speechrecog/backend
ExecStart=/opt/speechrecog/backend/venv/bin/python app.py
Restart=always
RestartSec=5
Environment=PATH=/opt/speechrecog/backend/venv/bin:/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable stt-backend
sudo systemctl start stt-backend
sudo systemctl status stt-backend
```

### 6. PM2 Service (Frontend)

```bash
sudo npm install -g pm2

cd /opt/speechrecog/frontend
pm2 start npm --name "stt-frontend" -- start
pm2 save
pm2 startup
```

### 7. Nginx Reverse Proxy

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/speechrecog > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # change this

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/speechrecog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Performance

| Metric              | Target    | Typical (RTX 4050) |
|---------------------|-----------|---------------------|
| Model load time     | <60s      | ~45s (first run)    |
| 5s audio → result   | <3s       | ~1.5-2.5s          |
| 15s audio → result  | <5s       | ~3-4s              |
| Memory usage (GPU)  | <4GB      | ~3-4 GB             |

---

## Troubleshooting

### "GPU not available"

```bash
# Check NVIDIA driver
nvidia-smi

# Check CUDA in Python
python3 -c "import torch; print(torch.cuda.is_available())"

# Reinstall with GPU support
pip uninstall -y torch onnxruntime-gpu
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install onnxruntime-gpu
```

### "Model failed to load"

The app will auto-fallback to CPU. Check logs:
```bash
sudo journalctl -u stt-backend -f
```

### "Microphone permission denied"

- Make sure HTTPS is used (Chrome requires secure context for `getUserMedia`)
- On localhost (http://localhost:3000) it works for development
- On production, use HTTPS

### "Transcription timeout"

- Larger audio files (>20s) may take longer
- Adjust timeout in `backend/app.py`: `MAX_AUDIO_SIZE_MB`
- Check GPU memory: `nvidia-smi`

### "Chat service not ready" / `/chat` returns 503

- Make sure `GEMINI_API_KEY` is set in your `.env` file
- Get a free key at https://aistudio.google.com/apikey
- Restart the backend after setting the key
- Verify with `curl http://localhost:8000/health` — `chat_ready` should be `true`

---

## License

MIT

---

## Docker / Podman Deployment

A `docker-compose.yml` is provided for one-command deployment with **Docker** or **Podman**.

### Prerequisites

- Docker Engine 24+ **or** Podman 5+
- NVIDIA Container Toolkit (Docker) or `nvidia-container-toolkit` (Podman)
- GPU: NVIDIA RTX 4050+ recommended

### Quick Deploy

```bash
# Clone & enter the repo
cd speechrecog

# ── With Docker ──
# GPU mode (Faster-Whisper on RTX 4050)
docker compose --profile gpu up -d --build

# CPU-only mode (no GPU)
docker compose up -d --build

# ── With Podman ──
# Podman Compose is built-in (podman compose)
# GPU mode — Podman uses nvidia-container-toolkit under the hood
podman compose --profile gpu up -d --build

# CPU-only mode
podman compose up -d --build
```

After startup (~60s for model download + loading):

```bash
# Check services
docker compose ps
# or
podman compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

Open [http://localhost:3000](http://localhost:3000)

### Docker Architecture

```
┌──────────────────────┐
│  Browser             │
│  localhost:3000      │
└──────────┬───────────┘
           │
   ┌───────▼────────┐
   │  nginx (built  │
   │   into frontend│
   └───────┬────────┘
           │ /api/* → http://backend:8000/*
   ┌───────▼────────┐
   │  Backend       │
   │  FastAPI       │◄── NVIDIA GPU (CUDA)
   │  :8000         │
   └────────────────┘
```

### Configuration

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

| Variable                | Default                | Description                                                |
|-------------------------|------------------------|------------------------------------------------------------|
| `FRONTEND_PORT`         | `3000`                 | Host port for frontend                                     |
| `NEXT_PUBLIC_API_URL`   | `http://backend:8000`  | Backend URL (internal Docker DNS)                          |
| `GEMINI_API_KEY`        | *(empty)*              | Google Gemini API key. **Required for `/chat`** (roleplay). Leave empty to disable the chat feature. |

### GPU Notes

**Docker:** Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

```bash
# Verify GPU passthrough
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

**Podman:** Requires `nvidia-container-toolkit` and `container-gpu` capability

```bash
# Verify GPU passthrough
podman run --rm --device nvidia.com/gpu=all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

### Model Persistence

The Faster-Whisper medium model (~2 GB) is downloaded on first run and cached in the `whisper-model-cache` volume. Without this volume, the model re-downloads on every rebuild.

```bash
# Inspect cache
podman volume inspect speechrecog_whisper-model-cache
# or
docker volume inspect speechrecog_whisper-model-cache
```

### Stop & Clean Up

```bash
# Stop all services
docker compose down
# or
podman compose down

# Stop + remove volumes (model cache will be deleted!)
docker compose down -v
podman compose down -v
```
