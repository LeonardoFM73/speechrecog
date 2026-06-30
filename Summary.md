# Program Flow Summary — Japanese STT + Roleplay (Guru Jepang)

## TL;DR

Satu halaman web dengan dua mode:
1. **Transcribe** — ucapkan bahasa Jepang → muncul teks Jepang langsung (Faster-Whisper lokal, GPU RTX 4050).
2. **Roleplay (Guru Jepang)** — ucapkan bahasa Jepang → STT → Gemini roleplay berdasarkan skenario → balik dalam bahasa Jepang + terjemahan Indonesia.

Pipeline untuk kedua mode sama di awal: `mic → MediaRecorder → webm → POST /transcribe → Faster-Whisper → teks Jepang`.
Mode Roleplay menambahkan langkah: `teks Jepang → POST /chat → Gemini → {reply_jp, reply_translation}`.

---

## Alur Program (Sequence Diagram)

### Mode 1: Transcribe

```
User (di browser)                    Frontend (Next.js)                   Backend (FastAPI)            Faster-Whisper
     │                                   │                                   │                             │
     │  1. Klik mic                      │                                   │                             │
     │────────────────────���─────────────>│                                   │                             │
     │                                   │  2. navigator.mediaDevices        │                             │
     │                                   │       .getUserMedia({audio:true}) │                             │
     │                                   │───────────────────────────────────────────────────────────────►│
     │                                   │                                   │                             │
     │  3. [merekam audio...]            │                                   │                             │
     │  ◂─────────────────────────────── │                                   │                             │
     │                                   │                                   │                             │
     │  4. Klik stop                     │                                   │                             │
     │──────────────────────────────────>│                                   │                             │
     │                                   │  5. stopRecording() → Blob        │                             │
     │                                   │       (audio/webm)                │                             │
     │                                   │───────────────────────────────────────────────────────────────►│
     │                                   │  6. Blob, status="uploading"      │                             │
     │                                   │──────────────────────────────────>│                             │
     │                                   │                                   │  7. POST /transcribe (multipart)│
     │                                   │                                   │─────────────────────────────►│
     │                                   │                                   │                             │
     │                                   │                                   │  8. transcribe(audio_path)      │
     │                                   │                                   │─────────────────────────────►│
     │                                   │                                   │                             │  9. Whisper decode
     │                                   │                                   │                             │◂──────────────────────────
     │                                   │                                   │                             │
     │                                   │ 10. {"success", "text", "duration"}│                            │
     │                                   │◂──────────────────────────────────│                             │
     │ 11. Tampilkan hasil transkripsi   │                                   │                             │
     │◂──────────────────────────────────│                                   │                             │
```

**Request: `POST /transcribe`**
```
Content-Type: multipart/form-data
  └─ audio: <Blob (webm, ≤20 MB)>
```

**Response: `200 OK`**
```json
{
  "success": true,
  "text": "すみません、タクシーは空いていますか",
  "duration": 4.5,
  "language": "ja"
}
```

---

### Mode 2: Roleplay (Guru Jepang)

```
User (di browser)                    Frontend (Next.js)                   Backend (FastAPI)            LLM (Gemini)
     │                                   │                                   │                             │
     │  1. Klik "Roleplay" toggle        │                                   │                             │
     │──────────────────────────────────>│                                   │                             │
     │                                   │ 2. Tampil scenario picker         │                             │
     │◂──────────────────────────────────│                                   │                             │
     │                                   │                                   │                             │
     │  3. Pilih skenario (dropdown)     │                                   │                             │
     │──────────────────────────────────>│                                   │                             │
     │                                   │ 4. Set scenario.description       │                             │
     │◂──────────────────────────────────│                                   │                             │
     │                                   │                                   │                             │
     │  5. Klik mic → rekam → stop       │                                   │                             │
     │──────────────────────────────────>│                                   │                             │
     │                                   │ 6. POST /transcribe (sama seperti   │                             │
     │                                   │    mode Transcribe) → text Jepang   │                             │
     │                                   │──────────────��───────────────────>│                             │
     │                                   │◂── 7. { success, text, duration }│                             │
     │                                   │                                   │                             │
     │                                   │ 8. status="chatting"              │                             │
     │                                   │──────────────────────────────────>│                             │
     │                                   │                                   │  9. POST /chat (JSON)         │
     │                                   │                                   │  ──{"user_text":"駅まで",      │
     │                                   │                                   │   "scenario":"あなたは...",     │
     │                                   │                                   │   "history":[...]}              │
     │                                   │                                   │─────────────────────────────►│
     │                                   │                                   │                             │
     │                                   │                                   │ 10. Build system prompt        │
     │                                   │                                   │     + history[-10:]            │
     │                                   │                                   │─────────────────────────────►│
     │                                   │                                   │                             │ 11. Gemini generate_content
     │                                   │                                   │                             │     → response_mime_type=JSON
     │                                   │                                   │                             │◂──────────────────────────
     │                                   │ 12. {"reply_jp":"...", "reply":   │                             │
     │                                   │     "translation":"..."}            │                             │
     │                                   │◂───��──────────────────────────────│                             │
     │                                   │ 13. Append to history state       │                             │
     │                                   │ 14. status="complete"             │                             │
     │                                   │                                   │                             │
     │ 15. Tampilkan bubble JP + ID      │                                   │                             │
     │◂──────────────────────────────────│                                   │                             │
     │                                   │                                   │                             │
     │ 16. [repeat — giliran berikutnya] │                                   │                             │
     │    (history sudah ada di state)   │──────────────────────────────────>│─── POST /chat (with history)──►│
```

**Request: `POST /chat`**
```json
{
  "user_text": "駅までお願いします",
  "scenario": "あなたは東京でタクシーの運転手です。ユーザーが今、駅でタクシーを探��ています。",
  "history": [
    {"role": "user",  "text": "すみません、タクシーは空いていますか"},
    {"role": "model", "text": "はい、どうぞお乗りください"}
  ]
}
```

**Response: `200 OK`**
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

---

## Komponen Kunci

### Backend

| File | Peran |
|------|-------|
| `services/transcriber.py` | Singleton `TranscriptionService` — load Faster-Whisper sekali saat startup, reus untuk semua request `/transcribe`. GPU→CPU fallback. |
| `services/chat.py` | Singleton `ChatService` — inisialisasi Gemini client (butuh `GEMINI_API_KEY`). Method `chat(user_text, scenario, history)` → parse JSON `{reply_jp, reply_translation}`. Graceful degrade jika key tidak diset. |
| `app.py` | `POST /transcribe` (existing) + `POST /chat` (baru). Lifespan hook inisialisasi keduanya. `GET /health` punya field `chat_ready` baru. |
| `models/schemas.py` | `ChatMessage`, `ChatRequest`, `ChatResponse` (Pydantic validation). `HealthResponse` diperluas dengan `chat_ready`. |

### Frontend

| File | Peran |
|------|-------|
| `page.tsx` | State: `mode`, `scenario`, `customScenario`, `history`, `lastTranslation`. `handleStop` memanggil `/transcribe` → jika mode `roleplay` lanjut ke `/chat`. |
| `components/ScenarioPicker.tsx` | Dropdown 5 skenario preset + custom input. Parent mengontrol value via props. |
| `components/ChatHistory.tsx` | Render bubble chat bergantian (biru=user, ungu=model). Auto-scroll ke bawah saat ada pesan baru. Translation Indonesia tampil di bawah bubble model terakhir. |
| `services/api.ts` | `chatClient.send(payload, baseUrl)` — POST ke `/chat`, parsing JSON response. |
| `types/audio.ts` | `AppMode`, `ChatRole`, `ChatMessage`, `ChatScenario`, `PRESET_SCENARIOS`, status `chatting`. |

---

## Alur Data (State Flow)

```
┌─ User opens page ─┐
│ mode = "transcribe"│
│ scenario = taxi     │
│ history = []        │
│ status = "idle"     │
└────────┬───────────┘
         │
    ┌────▼──────────────────────────┐
    │ User clicks mic, speaks       │
    │ status = "recording"          │
    └────┬──────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │ User clicks stop              │
    │ Blob (webm)                   │
    │ status = "uploading"          │
    └────┬──────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │ POST /transcribe → text Jepang │
    │ status = "transcribing"        │
    └────┬──────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  IF mode == "transcribe"       │
    │    → show result, status="done"│
    │                                │
    │  IF mode == "roleplay"         │
    │    → POST /chat(scenario, text)│
    │    → append to history         │
    │    → status="done"             │
    │    → show bubble + translation │
    └────────────────────────────────┘
```

---

## Konfigurasi Penting

| Env Variable | Required untuk | Default | Keterangan |
|---|---|---|---|
| `GEMINI_API_KEY` | Roleplay mode | *(kosong)* | API key dari Google AI Studio. Tanpa ini `/chat` return 503. |
| `FRONTEND_PORT` | Semua | `3000` | Port frontend exposed ke host |
| `NEXT_PUBLIC_API_URL` | Semua (Docker) | `http://backend:8000` | URL backend dari frontend container |

**Cara dapatkan Gemini API key:** https://aistudio.google.com/apikey (gratis untuk free tier).

---

## Error Handling

| Situasi | HTTP Status | Pesan ke user |
|---------|-------------|---------------|
| GEMINI_API_KEY belum diset | 503 | "Chat service is not available." |
| Text kosong di `/chat` | 400 | Validasi Pydantic (min 1 char) |
| History > 50 turns di `/chat` | 422 | Validasi Pydantic (max 50) |
| Gemini API error / timeout | 502 | "LLM provider error: ..." |
| Webhook LLM return JSON salah | 502 | Parse error + log di backend |
| Mic permission denied | N/A | Error dari MediaRecorder API |
| Empty recording | N/A | "Recording is empty. Please try again." |
| File audio > 20 MB | 413 | "Audio too large: X MB (max 20 MB)" |

---

## Catatan Arsitektur

- **Chat tidak menguras GPU** — Gemini jalan di cloud. RTX 4050 hanya dipakai Whisper.
- **History dibatasi** — backend cutat ke 10 turn terakhir, frontend max 50. Ini untuk kontrol biaya token.
- **Prompt injection mitigation** — user_text langsung masuk system prompt sebagai `{scenario}`, bukan sebagai instruction. Model punya system prompt yang membatasi format output.
- **Graceful degradation** — jika Gemini API tidak reachable, backend tetap jalankan `/transcribe` normal. Mode Roleplay hanya return 503.
- **Session history di frontend** — tidak disimpan di database. History hidup selama session di browser (React `useState`). Refresh = reset.
