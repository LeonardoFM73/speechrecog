# Frontend Revamp + Session Persistence — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorming complete)
**Scope:** Frontend (Next 15) visual + interactive overhaul, plus MongoDB-backed per-session persistence of student-AI interactions.

## Goals

1. Light-mode visual identity (white + blue, clean SaaS feel) replacing current dark `#0a0a0f` theme.
2. Avatar system for roleplay partners with reactive states (idle / listening / speaking).
3. Polished interactive surfaces: mic button, scenario cards, chat bubbles, status indicator.
4. Per-session persistence in MongoDB so student-AI interactions survive browser refreshes and can be analysed later.
5. No PII collected. Privacy-first. Sessions are explicit-start / explicit-end, resumable by UUID stored in browser localStorage.

## Non-Goals

- User accounts, login, multi-device sync.
- Long-term retention policy / GDPR delete flow (handled manually by purging the Mongo collection).
- Audio blob storage (we store metadata only; future GridFS hook left as `audio_blob_ref` nullable field).
- Mobile app or PWA install.
- Backend changes outside the new sessions router + Mongo wiring.

## Architecture

```
Browser                          FastAPI backend                MongoDB
─────────                        ───────────────                ───────
localStorage[session_id]
       │
       ▼
useSession hook ── POST /sessions ──────────────►  upsert session doc
                 ── PATCH /sessions/{id} ────────►  update mode/scenario/ended_at
                 ── POST /sessions/{id}/messages ►  append turn
                 ◄── GET /sessions/{id} ─────────  rehydrate on resume
                                                         │
                                                         ▼
                                                  speechrecog.sessions
                                                  (unique index on session_id)
```

Frontend stays a single-page Next.js app. The existing STT (Whisper) and TTS (VOICEVOX) call paths are unchanged; session persistence is layered on top via the new `useSession` hook without altering the audio pipeline.

## Frontend Theme & Tokens

`frontend/app/globals.css` swaps dark variables for a light blue/white palette:

| Token | Old | New |
|---|---|---|
| `--bg-primary` | `#0a0a0f` | `#ffffff` |
| `--bg-card` | `#13131f` | `#f8fafc` |
| `--bg-card-hover` | `#1a1a2e` | `#eff6ff` |
| `--border-subtle` | `#2a2a3e` | `#e2e8f0` |
| `--text-primary` | `#e4e4e7` | `#0f172a` |
| `--text-secondary` | `#a1a1aa` | `#475569` |
| `--accent-blue` | `#3b82f6` | `#2563eb` |
| `--accent-purple` | `#8b5cf6` | `#7c3aed` |
| `--accent-red` | `#ef4444` | `#dc2626` |
| `--accent-green` | `#22c55e` | `#16a34a` |

Body background: white with a subtle radial gradient from top (`from-blue-50/40` to white). Cards use `bg-white` with `border-slate-200` and `shadow-card` (custom Tailwind shadow: `0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)`). Focus / active states use `shadow-glow` (blue ring).

## Avatar System

New component `frontend/app/components/Avatar.tsx` with three reactive states. Eight inline SVG illustrations live in `frontend/app/components/avatars/`:

| id | Title (JP / EN) | Character |
|---|---|---|
| `sensei` | 教師 / Teacher | Glasses, book |
| `tencho` | 店長 / Shopkeeper | Apron, counter |
| `tomodachi` | 友達 / Friend | Casual, smile |
| `isha` | 医者 / Doctor | Stethoscope, white coat |
| `untenshu` | 運転手 / Taxi Driver | Cap, steering wheel hint |
| `ekin` | 駅員 / Station Staff | Uniform, hat |
| `kanriin` | ホテル係 / Hotel Staff | Suit, name tag |
| `custom` | カスタム / Custom | Neutral question-mark bubble (placeholder for custom scenario) |

All SVGs use a single blue palette + one accent colour, 120×120 viewBox, no external assets.

**State machine:**
- `idle` — static avatar with a 4 s breathing animation (scale 1.0 → 1.02 → 1.0).
- `listening` — three staggered pulse rings around the avatar (1.5 s loop).
- `speaking` — mouth scaleY driven by TTS playback amplitude (0.3 → 1.0 → 0.3). Random eye-blink every 3–5 s.

**Custom scenario fallback:** when `scenario.id === CUSTOM_SCENARIO_ID` and `customScenario` is empty, render a placeholder card (lucide `MessageCircleQuestion` + prompt "Describe the scenario" + inline textarea) instead of an avatar.

## Interactive Surfaces

All motion handled by `framer-motion`. Icons from `lucide-react`. New dependencies: `framer-motion`, `lucide-react` (frontend); `motor` (backend).

1. **MicButton** — `whileTap={{ scale: 0.94 }}` / `whileHover={{ scale: 1.04 }}`. Idle: blue circle, lucide `Mic`. Recording: red circle, lucide `Square`, three staggered pulse rings. Disabled: gray, lucide `MicOff`. Below the button: 5-bar waveform whose scaleY is driven by mic RMS (consumed from a new `level` field exposed by `useMicrophone`).
2. **ScenarioPicker → cards** — 4-col responsive grid (2-col on mobile) of `<ScenarioCard>` components. Each card shows `<Avatar scenarioId={id} state="idle" size="sm" />` + JP/EN titles + short description. Selected card has a blue ring + `shadow-glow`. `LayoutGroup` with shared `layoutId` for the selection transition. Custom card last, with lucide `Pencil` + inline text input. Hover lifts `y: -4`; tap scales 0.97.
3. **ChatHistory bubbles** — User bubble: blue (`bg-blue-600 text-white`), right-aligned, small lucide `User` avatar. AI bubble: white card, left-aligned, scenario avatar `size="sm"` + scenario title + JP text + muted translation. New messages use `AnimatePresence` with `initial={{ opacity:0, y:8, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}`. Each AI bubble has a lucide `Play` / `Pause` button calling `audioForLastReply` (or the per-message `audioUrl` — see data flow). Auto-scroll to bottom on new message.
4. **StatusIndicator** — Pill with lucide icon per state (`Mic` / `Loader2` spin / `Bot` / `Volume2` / `CheckCircle2` / `AlertCircle`). Colours: blue idle, red recording, spinning blue for uploading/transcribing, purple chatting, green speaking, green check complete, red error. AnimatePresence between states.

## Data Flow & Audio

**Per-message audio.** Current code keeps a single `replyAudioUrl` for the latest AI reply. To support per-bubble replay, the `ChatMessage` type gains `audioUrl?: string`. The blob URL is populated when the message is synthesised and revoked when the message is removed or the conversation is cleared (new `useEffect` keyed off `history.length` handles revocation).

**Mic level.** `useMicrophone` extends its return value with `level: number` (0–1 smoothed RMS) and the underlying `AudioContext`. Waveform bars in `MicButton` consume `level` directly.

**TTS playback hook.** New `frontend/app/hooks/useAudioPlayback.ts`:
- `useAudioPlayback(blobUrl | null) → { isPlaying, play, stop, analyser }`
- Lazily creates an `AudioContext` on first play, decodes the blob into an `AudioBufferSourceNode`, pipes to destination + an `AnalyserNode`.
- On `ended` → `isPlaying = false`.
- Avatar consumes `analyser` to drive mouth scaleY at ~30 fps via `requestAnimationFrame`.

**Avatar state derivation in `page.tsx`:**
- `isRecording || status === "recording"` → `listening`
- `status === "speaking" && replyAudioUrl && ttsIsPlaying` → `speaking` (only while TTS audio is actually playing). `ttsIsPlaying` is a boolean lifted from `useAudioPlayback(replyAudioUrl).isPlaying` into `page.tsx` state.
- else → `idle`

Avatar placed above `MicButton` in roleplay mode, `size="lg"`, centred.

## Error / Warning Banners

Existing yellow/blue/red text blocks gain lucide icons (`AlertTriangle` / `Info` / `XCircle`) and switch to light-mode colour variants:

- Chat not ready: `bg-yellow-50 border-yellow-200 text-yellow-800`
- TTS not ready: `bg-blue-50 border-blue-200 text-blue-800`
- Error: `bg-red-50 border-red-200 text-red-800`

## MongoDB Persistence

**Stack:** add `mongo:7` service to all docker-compose files. Backend uses `motor` (async driver) + `pymongo`. Connection via `MONGODB_URL` env var (default `mongodb://mongo:27017`), database name `speechrecog`.

**Collection `sessions`:**

```json
{
  "_id": ObjectId,
  "session_id": "uuid-v4",
  "started_at": ISODate,
  "ended_at": ISODate | null,
  "mode": "transcribe | roleplay",
  "scenario_id": "sensei | tencho | ... | custom",
  "scenario_text": "string | null",
  "speaker_id": 2,
  "messages": [
    {
      "turn": 1,
      "ts": ISODate,
      "user_text": "こんにちは",
      "language": "ja",
      "audio_duration_ms": 1234,
      "ai_reply_jp": "こんにちは！",
      "ai_reply_translation": "Hello!",
      "tts_speaker_id": 2,
      "audio_blob_ref": null,
      "scenario_switched": false,
      "error": null
    }
  ],
  "user_metadata": {}
}
```

**Indexes:** `session_id` (unique), `started_at` descending, `messages.scenario_switched` (analytics).

**Backend endpoints (FastAPI):**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sessions` | Upsert session by `session_id`; sets `started_at = now`, `mode = "roleplay"`. Returns `{session_id, started_at}`. |
| `PATCH` | `/sessions/{session_id}` | Update `ended_at` / `mode` / `scenario_id` / `scenario_text` / `speaker_id`. |
| `POST` | `/sessions/{session_id}/messages` | Append one message. Returns `{turn}`. |
| `GET` | `/sessions/{session_id}` | Fetch full doc (used on resume). |
| `GET` | `/health` | Extended with `dbReady` flag probing Mongo. |

**Frontend `useSession` hook:**
- On mount, read `session_id` from localStorage.
- If present, `GET /sessions/{id}` → rehydrate `mode`, `scenario`, `history`.
- If absent, render a "Start session" CTA (lucide `PlayCircle`). Click → generate UUID v4 → `POST /sessions` → store in localStorage → hide CTA.
- `handleStop` in `page.tsx` calls `POST /sessions/{id}/messages` after every turn (fire-and-forget with error log).
- "End session" button in header → `PATCH ended_at` → clear localStorage → show post-session summary card (turns count, total duration, scenarios used).
- Mongo unreachable → frontend degrades gracefully: turns still work, yellow warning banner "Session not persisting", next successful turn clears the banner.

## Files Touched

**Modify:**
- `frontend/app/globals.css` — token swap
- `frontend/app/layout.tsx` — font + meta
- `frontend/app/page.tsx` — wire `useSession`, derive `avatarState`, post-turn persistence
- `frontend/app/tailwind.config.js` — add `shadow-card`, `shadow-glow`, keyframes
- `frontend/app/hooks/useMicrophone.ts` — expose `level`, `audioContext`
- `frontend/app/types/audio.ts` — add `audioUrl?` to `ChatMessage`
- `frontend/app/components/MicButton.tsx`
- `frontend/app/components/StatusIndicator.tsx`
- `frontend/app/components/ResultCard.tsx`
- `frontend/app/components/ScenarioPicker.tsx`
- `frontend/app/components/SpeakerPicker.tsx`
- `frontend/app/components/ChatHistory.tsx`
- `frontend/app/components/DurationBar.tsx`
- `frontend/app/services/api.ts` — add session client functions
- `backend/main.py` — wire sessions router + extend `/health`
- `docker-compose.yml`, `docker-compose.local.yml`, `docker-compose.server.yml` — add `mongo` service, `MONGODB_URL` env
- `frontend/.env.example` — already has `NEXT_PUBLIC_API_URL`, no change
- `backend/requirements.txt` (or pyproject) — add `motor`

**New:**
- `frontend/app/components/Avatar.tsx`
- `frontend/app/components/avatars/{sensei,tencho,tomodachi,isha,untenshu,ekin,kanriin,custom}.tsx`
- `frontend/app/components/ScenarioCard.tsx`
- `frontend/app/hooks/useAudioPlayback.ts`
- `frontend/app/hooks/useSession.ts`
- `backend/db.py`
- `backend/models.py`
- `backend/routes/__init__.py`
- `backend/routes/sessions.py`

**New dependencies:**
- Frontend: `framer-motion`, `lucide-react`
- Backend: `motor`

## Testing

No test framework is present in the repository. Verification is manual via Docker Compose and browser:

1. `npm run build` (frontend) — clean compile.
2. `docker compose -f docker-compose.local.yml up --build` — all services start, including `mongo`.
3. Cold browser load at `http://localhost:3000` — "Start session" CTA visible. Click → session doc appears in Mongo (`db.sessions.findOne()`).
4. Roleplay flow: pick scenario, pick speaker, record, hear AI reply, see bubble animate in. Repeat 3 turns → 3 messages in `messages[]` array.
5. Transcribe flow: switch mode, record, see ResultCard. Transcribe turns are also appended to the same session.
6. Refresh page mid-session — history rehydrates, scenario rehydrates, mode rehydrates.
7. Click "End session" — `ended_at` set in Mongo, CTA reappears on next mount, post-session summary shown.
8. Custom scenario empty → placeholder card renders, no avatar.
9. Stop Mongo container → yellow banner appears, app still functional; restart Mongo → next turn clears the banner.
10. Mic permission denial — error path still graceful, no crash.
11. TTS engine down — roleplay text replies still shown, no audio bubbles, no crash.
12. All 8 scenario cards render correct avatar + name; selected card has blue ring.
13. Avatar mouth moves while TTS plays; pulse rings visible while recording.
14. Lighthouse a11y ≥ 90: focus rings preserved on all icon buttons, `aria-label` on icon-only buttons.

## Out of Scope (Future)

- User accounts and cross-device sync.
- Audio blob storage in GridFS.
- Retention / automatic purge of old sessions.
- Admin dashboard for browsing past sessions.
- Export to CSV / Anki deck.
