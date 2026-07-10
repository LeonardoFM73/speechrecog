# Frontend Revamp + Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark theme with a clean light blue/white SaaS look, add reactive avatars + motion-driven interactive surfaces for the Japanese STT/roleplay app, and persist every student-AI session to MongoDB for later analysis.

**Architecture:** In-place refactor of the Next.js frontend (new `Avatar` + `ScenarioCard` + motion-wrapped existing components) plus a new FastAPI router (`/sessions`) backed by a `mongo:7` docker service. Frontend gains a `useSession` hook (UUID in `localStorage`, explicit start/end) that rehydrates state on reload and POSTs each turn to the backend. Backend persists the full session + per-turn message log; frontend degrades gracefully if Mongo is unreachable.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3.4, framer-motion, lucide-react, FastAPI, motor (async MongoDB), MongoDB 7.

---

## File Structure

**Created (frontend):**
- `frontend/app/components/Avatar.tsx` — stateful avatar wrapper
- `frontend/app/components/avatars/index.ts` — barrel export
- `frontend/app/components/avatars/sensei.tsx`
- `frontend/app/components/avatars/tencho.tsx`
- `frontend/app/components/avatars/tomodachi.tsx`
- `frontend/app/components/avatars/isha.tsx`
- `frontend/app/components/avatars/untenshu.tsx`
- `frontend/app/components/avatars/ekin.tsx`
- `frontend/app/components/avatars/kanriin.tsx`
- `frontend/app/components/avatars/custom.tsx`
- `frontend/app/components/ScenarioCard.tsx` — motion card for scenario picker
- `frontend/app/hooks/useAudioPlayback.ts` — TTS audio playback + analyser
- `frontend/app/hooks/useSession.ts` — start/end/resume/persist session

**Created (backend):**
- `backend/db.py` — motor client + collection accessors
- `backend/models.py` — pydantic models for sessions
- `backend/routes/__init__.py`
- `backend/routes/sessions.py` — `/sessions` router

**Modified (frontend):**
- `frontend/app/globals.css` — light token palette
- `frontend/app/layout.tsx` — font + meta
- `frontend/app/page.tsx` — wire `useSession`, derive `avatarState`, per-message audio
- `frontend/app/tailwind.config.js` — shadows + keyframes
- `frontend/app/hooks/useMicrophone.ts` — expose `level`, `audioContext`
- `frontend/app/types/audio.ts` — add `audioUrl?` to `ChatMessage`
- `frontend/app/services/api.ts` — add session client
- `frontend/app/components/MicButton.tsx`
- `frontend/app/components/StatusIndicator.tsx`
- `frontend/app/components/ResultCard.tsx`
- `frontend/app/components/ScenarioPicker.tsx`
- `frontend/app/components/SpeakerPicker.tsx`
- `frontend/app/components/ChatHistory.tsx`
- `frontend/app/components/DurationBar.tsx`
- `frontend/package.json` — add `framer-motion`, `lucide-react`

**Modified (backend):**
- `backend/main.py` — wire sessions router + extend `/health`
- `backend/requirements.txt` (or equivalent) — add `motor`

**Modified (infra):**
- `docker-compose.yml` — add `mongo` service, `MONGODB_URL` env
- `docker-compose.local.yml` — unchanged (frontend only)
- `docker-compose.server.yml` — add `mongo` service, `MONGODB_URL` env
- `frontend/.env.example` — document `NEXT_PUBLIC_API_URL` (no change to value)

---

## Task 1: Theme tokens (globals.css)

**Files:**
- Modify: `frontend/app/globals.css:1-48`

- [ ] **Step 1: Replace the `:root` block with the light palette**

Replace the existing `:root` block (lines 5–16) with:

```css
:root {
  --bg-primary: #ffffff;
  --bg-card: #f8fafc;
  --bg-card-hover: #eff6ff;
  --border-subtle: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --accent-blue: #2563eb;
  --accent-purple: #7c3aed;
  --accent-red: #dc2626;
  --accent-green: #16a34a;
}
```

- [ ] **Step 2: Add a subtle body gradient**

Replace `body { ... }` (lines 18–22) with:

```css
body {
  background:
    radial-gradient(ellipse at top, rgba(219, 234, 254, 0.4), transparent 60%),
    #ffffff;
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 3: Update the mic-wave bar colour**

Change `background: var(--accent-red);` (line 33) to `background: var(--accent-blue);`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat(frontend): switch to light blue/white theme tokens"
```

---

## Task 2: Tailwind shadows + keyframes

**Files:**
- Modify: `frontend/app/tailwind.config.js:1-31`

- [ ] **Step 1: Add `shadow-card`, `shadow-glow`, and `animate-pulse-ring` extensions**

Replace the entire file content with:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)",
        glow: "0 0 0 4px rgba(37,99,235,0.15)",
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "wave": "wave 1.2s ease-in-out infinite",
        "breathe": "breathe 4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.3", transform: "scale(1.15)" },
        },
        "wave": {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1.5)" },
        },
        "breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/tailwind.config.js
git commit -m "feat(frontend): add card/glow shadows and breathe keyframe"
```

---

## Task 3: Add frontend dependencies

**Files:**
- Modify: `frontend/package.json:1-26`

- [ ] **Step 1: Add framer-motion and lucide-react**

Replace the entire `package.json` content with:

```json
{
  "name": "japanese-stt-frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "framer-motion": "^11.15.0",
    "lucide-react": "^0.468.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd frontend && npm install`
Expected: installs `framer-motion` and `lucide-react`, no peer-dep errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add framer-motion and lucide-react"
```

---

## Task 4: Avatar SVG illustrations (8 files)

**Files:**
- Create: `frontend/app/components/avatars/sensei.tsx`
- Create: `frontend/app/components/avatars/tencho.tsx`
- Create: `frontend/app/components/avatars/tomodachi.tsx`
- Create: `frontend/app/components/avatars/isha.tsx`
- Create: `frontend/app/components/avatars/untenshu.tsx`
- Create: `frontend/app/components/avatars/ekin.tsx`
- Create: `frontend/app/components/avatars/kanriin.tsx`
- Create: `frontend/app/components/avatars/custom.tsx`
- Create: `frontend/app/components/avatars/index.ts`

- [ ] **Step 1: Create the teacher (`sensei`) avatar**

Create `frontend/app/components/avatars/sensei.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function SenseiAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Teacher">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <rect x="44" y="44" width="12" height="8" rx="2" fill="none" stroke="#0f172a" strokeWidth="2" />
      <rect x="64" y="44" width="12" height="8" rx="2" fill="none" stroke="#0f172a" strokeWidth="2" />
      <path d="M 48 70 Q 60 78 72 70" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="6" fill="#2563eb" />
      <rect x="40" y="86" width="40" height="6" rx="2" fill="#fde68a" />
    </svg>
  );
}
```

- [ ] **Step 2: Create the shopkeeper (`tencho`) avatar**

Create `frontend/app/components/avatars/tencho.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function TenchoAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Shopkeeper">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fed7aa" />
      <circle cx="52" cy="46" r="2" fill="#0f172a" />
      <circle cx="68" cy="46" r="2" fill="#0f172a" />
      <path d="M 50 60 Q 60 66 70 60" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="4" fill="#16a34a" />
      <rect x="50" y="82" width="20" height="22" fill="#0f172a" opacity="0.1" />
    </svg>
  );
}
```

- [ ] **Step 3: Create the friend (`tomodachi`) avatar**

Create `frontend/app/components/avatars/tomodachi.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function TomodachiAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Friend">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <path d="M 44 44 Q 50 36 60 36 Q 70 36 76 44" fill="#0f172a" />
      <circle cx="52" cy="50" r="2" fill="#0f172a" />
      <circle cx="68" cy="50" r="2" fill="#0f172a" />
      <path d="M 48 62 Q 60 72 72 62" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="6" fill="#f472b6" />
    </svg>
  );
}
```

- [ ] **Step 4: Create the doctor (`isha`) avatar**

Create `frontend/app/components/avatars/isha.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function IshaAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Doctor">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <circle cx="52" cy="46" r="2" fill="#0f172a" />
      <circle cx="68" cy="46" r="2" fill="#0f172a" />
      <path d="M 50 62 L 70 62" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="4" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
      <rect x="56" y="86" width="8" height="12" fill="#dc2626" />
      <rect x="54" y="90" width="12" height="4" fill="#dc2626" />
    </svg>
  );
}
```

- [ ] **Step 5: Create the taxi driver (`untenshu`) avatar**

Create `frontend/app/components/avatars/untenshu.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function UntenshuAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Taxi driver">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <rect x="36" y="34" width="48" height="18" rx="3" fill="#fde047" />
      <circle cx="60" cy="60" r="20" fill="#fde68a" />
      <circle cx="52" cy="58" r="2" fill="#0f172a" />
      <circle cx="68" cy="58" r="2" fill="#0f172a" />
      <path d="M 50 70 Q 60 76 70 70" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="84" width="56" height="22" rx="3" fill="#2563eb" />
    </svg>
  );
}
```

- [ ] **Step 6: Create the station staff (`ekin`) avatar**

Create `frontend/app/components/avatars/ekin.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function EkinAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Station staff">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <ellipse cx="60" cy="38" rx="24" ry="8" fill="#0f172a" />
      <rect x="40" y="38" width="40" height="6" fill="#0f172a" />
      <circle cx="60" cy="58" r="18" fill="#fde68a" />
      <circle cx="52" cy="56" r="2" fill="#0f172a" />
      <circle cx="68" cy="56" r="2" fill="#0f172a" />
      <path d="M 50 68 Q 60 74 70 68" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="80" width="56" height="26" rx="3" fill="#1e40af" />
    </svg>
  );
}
```

- [ ] **Step 7: Create the hotel staff (`kanriin`) avatar**

Create `frontend/app/components/avatars/kanriin.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function KanriinAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Hotel staff">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <path d="M 48 46 Q 60 38 72 46" stroke="#0f172a" strokeWidth="2" fill="none" />
      <circle cx="52" cy="50" r="2" fill="#0f172a" />
      <circle cx="68" cy="50" r="2" fill="#0f172a" />
      <path d="M 50 62 Q 60 68 70 62" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="3" fill="#0f172a" />
      <rect x="56" y="86" width="8" height="12" fill="#ffffff" />
    </svg>
  );
}
```

- [ ] **Step 8: Create the custom (`custom`) placeholder**

Create `frontend/app/components/avatars/custom.tsx`:

```tsx
import { AvatarProps } from "../Avatar";

export default function CustomAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Custom scenario">
      <circle cx="60" cy="60" r="56" fill="#e2e8f0" />
      <circle cx="60" cy="60" r="32" fill="#cbd5e1" />
      <text x="60" y="74" textAnchor="middle" fontSize="40" fill="#475569" fontFamily="system-ui">?</text>
    </svg>
  );
}
```

- [ ] **Step 9: Create the barrel export**

Create `frontend/app/components/avatars/index.ts`:

```ts
import { ComponentType } from "react";
import SenseiAvatar from "./sensei";
import TenchoAvatar from "./tencho";
import TomodachiAvatar from "./tomodachi";
import IshaAvatar from "./isha";
import UntenshuAvatar from "./untenshu";
import EkinAvatar from "./ekin";
import KanriinAvatar from "./kanriin";
import CustomAvatar from "./custom";
import { AvatarProps } from "../Avatar";

export const avatars: Record<string, ComponentType<AvatarProps>> = {
  sensei: SenseiAvatar,
  tencho: TenchoAvatar,
  tomodachi: TomodachiAvatar,
  isha: IshaAvatar,
  untenshu: UntenshuAvatar,
  ekin: EkinAvatar,
  kanriin: KanriinAvatar,
  custom: CustomAvatar,
};
```

- [ ] **Step 10: Commit**

```bash
git add frontend/app/components/avatars/
git commit -m "feat(frontend): add 8 inline SVG avatar illustrations"
```

---

## Task 5: Avatar component (stateful wrapper)

**Files:**
- Create: `frontend/app/components/Avatar.tsx`

- [ ] **Step 1: Create the Avatar component**

Create `frontend/app/components/Avatar.tsx`:

```tsx
"use client";

import { ComponentType, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { avatars } from "./avatars";

export interface AvatarProps {
  size?: number;
}

export type AvatarState = "idle" | "listening" | "speaking";

export interface AvatarComponentProps {
  scenarioId: string;
  state: AvatarState;
  size?: "sm" | "md" | "lg";
  audioLevelRef?: React.MutableRefObject<number>;
  className?: string;
}

const SIZE_MAP = { sm: 80, md: 120, lg: 160 } as const;

export default function Avatar({
  scenarioId,
  state,
  size = "md",
  audioLevelRef,
  className = "",
}: AvatarComponentProps) {
  const px = SIZE_MAP[size];
  const Component: ComponentType<AvatarProps> = avatars[scenarioId] ?? avatars.custom;
  const mouthRef = useRef<SVGRectElement | null>(null);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (state !== "speaking") return;
    let raf = 0;
    const tick = () => {
      const lvl = audioLevelRef?.current ?? 0;
      const scale = 0.3 + Math.min(1, lvl * 4) * 0.7;
      if (mouthRef.current) {
        mouthRef.current.setAttribute("transform", `scale(1, ${scale.toFixed(2)}) translate(0, ${((1 - scale) * 30).toFixed(2)})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, audioLevelRef]);

  useEffect(() => {
    if (state !== "idle") return;
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => window.clearInterval(id);
  }, [state]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
      <AnimatePresence>
        {state === "listening" &&
          [0, 0.5, 1].map((delay) => (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full border-2 border-blue-500"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.3, 1.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay }}
            />
          ))}
      </AnimatePresence>
      <motion.div
        className="relative"
        animate={state === "idle" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={state === "idle" ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <Component size={px} />
        {state === "speaking" && (
          <rect
            ref={mouthRef}
            x={px * 0.42}
            y={px * 0.55}
            width={px * 0.16}
            height={px * 0.08}
            rx={px * 0.04}
            fill="#0f172a"
            style={{ transformOrigin: "center" }}
          />
        )}
        {blink && (
          <div className="absolute inset-0 bg-white/80" style={{ width: px, height: px }} />
        )}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/components/Avatar.tsx
git commit -m "feat(frontend): add stateful Avatar component"
```

---

## Task 6: useAudioPlayback hook

**Files:**
- Create: `frontend/app/hooks/useAudioPlayback.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/app/hooks/useAudioPlayback.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioPlayback {
  isPlaying: boolean;
  play: () => Promise<void>;
  stop: () => void;
  analyser: AnalyserNode | null;
}

export function useAudioPlayback(blobUrl: string | null): AudioPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* noop */ }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async () => {
    if (!blobUrl) return;
    stop();
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    const buf = await fetch(blobUrl).then((r) => r.arrayBuffer());
    const audio = await ctx.decodeAudioData(buf);
    const source = ctx.createBufferSource();
    source.buffer = audio;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      source.disconnect();
      if (sourceRef.current === source) sourceRef.current = null;
    };
    source.start();
    sourceRef.current = source;
    analyserRef.current = analyser;
    setIsPlaying(true);
  }, [blobUrl, stop]);

  useEffect(() => {
    return () => {
      stop();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
    };
  }, [stop]);

  return { isPlaying, play, stop, analyser: analyserRef.current };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/hooks/useAudioPlayback.ts
git commit -m "feat(frontend): add useAudioPlayback hook with analyser"
```

---

## Task 7: Extend useMicrophone with level + audioContext

**Files:**
- Modify: `frontend/app/hooks/useMicrophone.ts`

- [ ] **Step 1: Read the current file**

Run: `cat frontend/app/hooks/useMicrophone.ts`

- [ ] **Step 2: Add `level` and `audioContext` to the return type**

The current return is roughly:

```ts
return { isRecording, duration, startRecording, stopRecording, hasPermission, permissionError };
```

Replace it with:

```ts
return { isRecording, duration, startRecording, stopRecording, hasPermission, permissionError, level, audioContext };
```

Add these state hooks near the other `useState` calls (after `const [permissionError, setPermissionError] = useState<string | null>(null);`):

```ts
const [level, setLevel] = useState<number>(0);
const audioContextRef = useRef<AudioContext | null>(null);
```

Also add `useRef` to the import (currently only `useState, useCallback, useRef` is imported — confirm; if `useRef` is missing, add it).

- [ ] **Step 3: Populate `level` from the mic stream analyser**

Inside `startRecording`, after `audioContextRef.current = ...` is created (or after the stream is acquired), add the analyser wiring. If no `AudioContext` is currently being created, add this block after the stream is obtained:

```ts
const ctx = audioContextRef.current ?? new AudioContext();
audioContextRef.current = ctx;
const source = ctx.createMediaStreamSource(stream);
const analyser = ctx.createAnalyser();
analyser.fftSize = 256;
const data = new Uint8Array(analyser.frequencyBinCount);
source.connect(analyser);
const tick = () => {
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  setLevel(Math.min(1, rms * 4));
  if (stream.active) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
```

Set `level` to `0` and close the context inside the `stopRecording` cleanup path:

```ts
setLevel(0);
audioContextRef.current?.close().catch(() => undefined);
audioContextRef.current = null;
```

- [ ] **Step 4: Type the return object**

The hook now returns `{ isRecording, duration, startRecording, stopRecording, hasPermission, permissionError, level, audioContext: audioContextRef.current }`. Make `audioContext` a getter or a state value if `ref.current` reading inside the return breaks reactivity. Simpler: expose `audioContext: audioContextRef.current` (consumers don't need it to be reactive).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/hooks/useMicrophone.ts
git commit -m "feat(frontend): expose mic level and audioContext from useMicrophone"
```

---

## Task 8: ChatMessage type + api.ts session client

**Files:**
- Modify: `frontend/app/types/audio.ts`
- Modify: `frontend/app/services/api.ts`

- [ ] **Step 1: Add `audioUrl` to ChatMessage**

Read `frontend/app/types/audio.ts`, locate the `ChatMessage` interface, add the field:

```ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  translation?: string;
  audioUrl?: string;
  ts?: number;
}
```

- [ ] **Step 2: Append session functions to `api.ts`**

Read `frontend/app/services/api.ts`. Append at the end:

```ts
export interface SessionTurn {
  turn: number;
  ts: number;
  user_text: string;
  language: string;
  audio_duration_ms: number;
  ai_reply_jp: string | null;
  ai_reply_translation: string | null;
  tts_speaker_id: number | null;
  audio_blob_ref: string | null;
  scenario_switched: boolean;
  error: string | null;
}

export interface SessionDoc {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  mode: "transcribe" | "roleplay";
  scenario_id: string;
  scenario_text: string | null;
  speaker_id: number | null;
  messages: SessionTurn[];
}

export const sessionClient = {
  async create(session_id: string, apiBase: string): Promise<SessionDoc> {
    const r = await fetch(`${apiBase}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });
    if (!r.ok) throw new Error(`Session create failed: ${r.status}`);
    return r.json();
  },
  async update(session_id: string, patch: Partial<SessionDoc>, apiBase: string): Promise<SessionDoc> {
    const r = await fetch(`${apiBase}/sessions/${session_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`Session update failed: ${r.status}`);
    return r.json();
  },
  async appendMessage(session_id: string, turn: SessionTurn, apiBase: string): Promise<{ turn: number }> {
    const r = await fetch(`${apiBase}/sessions/${session_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(turn),
    });
    if (!r.ok) throw new Error(`Message append failed: ${r.status}`);
    return r.json();
  },
  async get(session_id: string, apiBase: string): Promise<SessionDoc | null> {
    const r = await fetch(`${apiBase}/sessions/${session_id}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Session fetch failed: ${r.status}`);
    return r.json();
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/types/audio.ts frontend/app/services/api.ts
git commit -m "feat(frontend): add per-message audioUrl and session API client"
```

---

## Task 9: ScenarioCard component

**Files:**
- Create: `frontend/app/components/ScenarioCard.tsx`

- [ ] **Step 1: Create the card**

Create `frontend/app/components/ScenarioCard.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import Avatar from "./Avatar";
import { ChatScenario, CUSTOM_SCENARIO_ID } from "@/types/audio";

interface Props {
  scenario: ChatScenario;
  selected: boolean;
  onSelect: () => void;
  customValue?: string;
  onCustomChange?: (v: string) => void;
}

export default function ScenarioCard({ scenario, selected, onSelect, customValue, onCustomChange }: Props) {
  const isCustom = scenario.id === CUSTOM_SCENARIO_ID;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group flex w-full flex-col items-center gap-2 rounded-2xl border bg-white p-4 text-center shadow-card transition-shadow ${
        selected ? "border-blue-500 shadow-glow" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {isCustom ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <Pencil className="h-8 w-8 text-slate-500" />
        </div>
      ) : (
        <Avatar scenarioId={scenario.id} state="idle" size="sm" />
      )}
      <div className="text-sm font-semibold text-slate-900">{scenario.title}</div>
      <div className="text-xs text-slate-500 line-clamp-2">{scenario.description}</div>
      {isCustom && onCustomChange && (
        <input
          type="text"
          value={customValue ?? ""}
          onChange={(e) => onCustomChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Describe the scenario…"
          className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
        />
      )}
    </motion.button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/components/ScenarioCard.tsx
git commit -m "feat(frontend): add motion-driven ScenarioCard"
```

---

## Task 10: Rewrite ScenarioPicker to use cards

**Files:**
- Modify: `frontend/app/components/ScenarioPicker.tsx`

- [ ] **Step 1: Read the current file**

Run: `cat frontend/app/components/ScenarioPicker.tsx`

- [ ] **Step 2: Replace its contents with a card grid**

Replace the entire file with:

```tsx
"use client";

import { LayoutGroup } from "framer-motion";
import ScenarioCard from "./ScenarioCard";
import { ChatScenario, PRESET_SCENARIOS } from "@/types/audio";

interface Props {
  selected: ChatScenario;
  onChange: (s: ChatScenario) => void;
  customText: string;
  onCustomTextChange: (t: string) => void;
}

export default function ScenarioPicker({ selected, onChange, customText, onCustomTextChange }: Props) {
  return (
    <div className="mb-6 w-full max-w-2xl">
      <div className="mb-3 text-center text-sm font-medium text-slate-700">Choose a scenario</div>
      <LayoutGroup>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PRESET_SCENARIOS.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              selected={selected.id === s.id}
              onSelect={() => onChange({ ...s, description: s.id === "custom" ? customText : s.description })}
            />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/ScenarioPicker.tsx
git commit -m "feat(frontend): render scenario picker as a motion card grid"
```

---

## Task 11: Rewrite ChatHistory with bubbles + animation

**Files:**
- Modify: `frontend/app/components/ChatHistory.tsx`

- [ ] **Step 1: Read the current file**

Run: `cat frontend/app/components/ChatHistory.tsx`

- [ ] **Step 2: Replace its contents with a bubble list**

Replace the entire file with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, User } from "lucide-react";
import Avatar from "./Avatar";
import { ChatMessage } from "@/types/audio";
import { PRESET_SCENARIOS } from "@/types/audio";

interface Props {
  messages: ChatMessage[];
  lastTranslation: string | null;
  audioForLastReply: string | null;
}

function scenarioTitle(id?: string): string {
  if (!id) return "AI";
  return PRESET_SCENARIOS.find((s) => s.id === id)?.title ?? "AI";
}

export default function ChatHistory({ messages, lastTranslation, audioForLastReply }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const togglePlay = (idx: number, url: string | undefined) => {
    if (!url) return;
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingIdx(null);
    }
    audioRef.current.src = url;
    audioRef.current.play();
    setPlayingIdx(idx);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <AnimatePresence initial={false}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const audioUrl = isUser ? undefined : i === messages.length - 1 ? audioForLastReply ?? m.audioUrl : m.audioUrl;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                {isUser ? <User className="h-4 w-4 text-slate-600" /> : <Avatar scenarioId={scenarioTitle()} state="idle" size="sm" />}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-card ${
                  isUser ? "bg-blue-600 text-white" : "bg-white text-slate-900 border border-slate-200"
                }`}
              >
                {!isUser && <div className="mb-1 text-xs font-medium text-slate-500">{scenarioTitle()}</div>}
                <div className="whitespace-pre-wrap">{m.content}</div>
                {!isUser && m.translation && <div className="mt-1 text-xs text-slate-500">{m.translation}</div>}
                {!isUser && audioUrl && (
                  <button
                    type="button"
                    onClick={() => togglePlay(i, audioUrl)}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    aria-label={playingIdx === i ? "Pause" : "Play"}
                  >
                    {playingIdx === i ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    <span>{playingIdx === i ? "Pause" : "Play"}</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={bottomRef} />
      {lastTranslation && (
        <div className="text-center text-xs text-slate-500">Last translation: {lastTranslation}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/ChatHistory.tsx
git commit -m "feat(frontend): rewrite ChatHistory as motion-animated bubbles"
```

---

## Task 12: MicButton + StatusIndicator + ResultCard + SpeakerPicker + DurationBar

**Files:**
- Modify: `frontend/app/components/MicButton.tsx`
- Modify: `frontend/app/components/StatusIndicator.tsx`
- Modify: `frontend/app/components/ResultCard.tsx`
- Modify: `frontend/app/components/SpeakerPicker.tsx`
- Modify: `frontend/app/components/DurationBar.tsx`

- [ ] **Step 1: Read each file**

```bash
for f in MicButton StatusIndicator ResultCard SpeakerPicker DurationBar; do
  echo "===== $f ====="
  cat "frontend/app/components/${f}.tsx"
done
```

- [ ] **Step 2: Rewrite MicButton with motion + lucide + waveform**

Replace `frontend/app/components/MicButton.tsx` with:

```tsx
"use client";

import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";

interface Props {
  isRecording: boolean;
  hasPermission: boolean;
  onStart: () => void;
  onStop: () => void;
  level?: number;
}

export default function MicButton({ isRecording, hasPermission, onStart, onStop, level = 0 }: Props) {
  const disabled = hasPermission === false;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {[0, 0.5, 1].map((delay) =>
          isRecording ? (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full border-2 border-red-500"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.3, 1.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay }}
            />
          ) : null,
        )}
        <motion.button
          type="button"
          onClick={isRecording ? onStop : onStart}
          disabled={disabled}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: disabled ? 1 : 1.04 }}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-card focus:outline-none focus:ring-4 ${
            disabled
              ? "bg-slate-400 cursor-not-allowed"
              : isRecording
                ? "bg-red-600 focus:ring-red-200"
                : "bg-blue-600 focus:ring-blue-200"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {disabled ? <MicOff className="h-8 w-8" /> : isRecording ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
        </motion.button>
      </div>
      <div className="mic-wave" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="mic-wave-bar bg-blue-600"
            style={{
              transform: `scaleY(${0.4 + Math.min(1, level * 4) * (0.6 + Math.sin((Date.now() / 200) + i) * 0.4)})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite StatusIndicator with lucide icons**

Replace `frontend/app/components/StatusIndicator.tsx` with:

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Bot, Volume2, CheckCircle2, AlertCircle } from "lucide-react";
import { TranscriptionStatus } from "@/types/audio";

interface Props {
  status: TranscriptionStatus;
  label: string;
  isRecording: boolean;
}

const COLORS: Record<TranscriptionStatus | "recording", string> = {
  idle: "bg-slate-100 text-slate-700",
  recording: "bg-red-50 text-red-700",
  uploading: "bg-blue-50 text-blue-700",
  transcribing: "bg-blue-50 text-blue-700",
  chatting: "bg-purple-50 text-purple-700",
  speaking: "bg-green-50 text-green-700",
  complete: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-700",
};

function Icon({ status, isRecording }: { status: TranscriptionStatus; isRecording: boolean }) {
  if (isRecording) return <Mic className="h-3.5 w-3.5" />;
  switch (status) {
    case "uploading":
    case "transcribing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case "chatting":
      return <Bot className="h-3.5 w-3.5" />;
    case "speaking":
      return <Volume2 className="h-3.5 w-3.5" />;
    case "complete":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return <Mic className="h-3.5 w-3.5" />;
  }
}

export default function StatusIndicator({ status, label, isRecording }: Props) {
  const colour = isRecording ? COLORS.recording : COLORS[status] ?? COLORS.idle;
  return (
    <div className="my-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${status}-${isRecording}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${colour}`}
        >
          <Icon status={status} isRecording={isRecording} />
          <span>{label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite ResultCard with lucide**

Replace `frontend/app/components/ResultCard.tsx` with:

```tsx
"use client";

import { FileText, Clock, Languages } from "lucide-react";

interface Props {
  text: string;
  duration: number;
  language: string;
  isError: boolean;
}

export default function ResultCard({ text, duration, language, isError }: Props) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${isError ? "border-red-200" : "border-slate-200"}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FileText className="h-4 w-4" />
        <span>Transcription</span>
      </div>
      <div className="whitespace-pre-wrap text-base text-slate-900">{text}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {duration > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <Clock className="h-3 w-3" />
            {duration.toFixed(1)}s
          </span>
        )}
        {language && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <Languages className="h-3 w-3" />
            {language}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite SpeakerPicker as a popover list**

Replace `frontend/app/components/SpeakerPicker.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Volume2 } from "lucide-react";
import { Speaker } from "@/types/audio";

interface Props {
  selected: Speaker;
  onChange: (s: Speaker) => void;
  available: Speaker[];
  disabled?: boolean;
}

export default function SpeakerPicker({ selected, onChange, available, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const list = available.length > 0 ? available : [selected];
  return (
    <div className="relative mb-4 w-full max-w-md">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-card disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-blue-600" />
          {selected.name}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-card"
          >
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>{s.name}</span>
                  {s.id === selected.id && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite DurationBar for light theme**

Replace `frontend/app/components/DurationBar.tsx` with:

```tsx
"use client";

interface Props {
  duration: number;
  isActive: boolean;
}

export default function DurationBar({ duration, isActive }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all ${isActive ? "bg-blue-600" : "bg-slate-300"}`}
          style={{ width: `${Math.min(100, (duration / 30) * 100)}%` }}
        />
      </div>
      <div className="text-xs text-slate-500">{duration.toFixed(1)}s</div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/components/MicButton.tsx \
        frontend/app/components/StatusIndicator.tsx \
        frontend/app/components/ResultCard.tsx \
        frontend/app/components/SpeakerPicker.tsx \
        frontend/app/components/DurationBar.tsx
git commit -m "feat(frontend): polish interactive surfaces with motion and lucide"
```

---

## Task 13: useSession hook

**Files:**
- Create: `frontend/app/hooks/useSession.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/app/hooks/useSession.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionClient, SessionDoc, SessionTurn } from "@/services/api";

const STORAGE_KEY = "speechrecog.session_id";

export interface UseSession {
  sessionId: string | null;
  hydrated: SessionDoc | null;
  ready: boolean;
  dbReady: boolean;
  start: () => Promise<void>;
  end: () => Promise<void>;
  updateMeta: (patch: Partial<SessionDoc>) => Promise<void>;
  appendTurn: (turn: SessionTurn) => Promise<void>;
}

function uuidv4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSession(apiBase: string): UseSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<SessionDoc | null>(null);
  const [ready, setReady] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const apiBaseRef = useRef(apiBase);
  apiBaseRef.current = apiBase;

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setReady(true);
      return;
    }
    setSessionId(id);
    sessionClient
      .get(id, apiBaseRef.current)
      .then((doc) => {
        setHydrated(doc);
        setReady(true);
      })
      .catch(() => {
        setDbReady(false);
        setReady(true);
      });
  }, []);

  const start = useCallback(async () => {
    const id = uuidv4();
    try {
      const doc = await sessionClient.create(id, apiBaseRef.current);
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated(doc);
      setDbReady(true);
    } catch {
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated({
        session_id: id,
        started_at: new Date().toISOString(),
        ended_at: null,
        mode: "roleplay",
        scenario_id: "sensei",
        scenario_text: null,
        speaker_id: null,
        messages: [],
      });
      setDbReady(false);
    }
  }, []);

  const end = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sessionClient.update(sessionId, { ended_at: new Date().toISOString() }, apiBaseRef.current);
    } catch {
      /* swallow */
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setSessionId(null);
      setHydrated(null);
    }
  }, [sessionId]);

  const updateMeta = useCallback(
    async (patch: Partial<SessionDoc>) => {
      if (!sessionId) return;
      try {
        const doc = await sessionClient.update(sessionId, patch, apiBaseRef.current);
        setHydrated(doc);
        setDbReady(true);
      } catch {
        setDbReady(false);
      }
    },
    [sessionId],
  );

  const appendTurn = useCallback(
    async (turn: SessionTurn) => {
      if (!sessionId) return;
      try {
        await sessionClient.appendMessage(sessionId, turn, apiBaseRef.current);
        setDbReady(true);
      } catch {
        setDbReady(false);
      }
    },
    [sessionId],
  );

  return { sessionId, hydrated, ready, dbReady, start, end, updateMeta, appendTurn };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/hooks/useSession.ts
git commit -m "feat(frontend): add useSession hook for explicit start/end persistence"
```

---

## Task 14: Backend — motor client + pydantic models

**Files:**
- Create: `backend/db.py`
- Create: `backend/models.py`

- [ ] **Step 1: Create db.py**

Create `backend/db.py`:

```python
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGODB_DB", "speechrecog")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=2000)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[DB_NAME]


def sessions() -> AsyncIOMotorCollection:
    return get_db()["sessions"]


async def ensure_indexes() -> None:
    await sessions().create_index("session_id", unique=True)
    await sessions().create_index([("started_at", -1)])
    await sessions().create_index("messages.scenario_switched")


async def ping() -> bool:
    try:
        await get_client().admin.command("ping")
        return True
    except Exception:
        return False
```

- [ ] **Step 2: Create models.py**

Create `backend/models.py`:

```python
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class MessageIn(BaseModel):
    turn: int
    ts: float
    user_text: str
    language: str = ""
    audio_duration_ms: int = 0
    ai_reply_jp: Optional[str] = None
    ai_reply_translation: Optional[str] = None
    tts_speaker_id: Optional[int] = None
    audio_blob_ref: Optional[str] = None
    scenario_switched: bool = False
    error: Optional[str] = None


class SessionCreate(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)


class SessionPatch(BaseModel):
    ended_at: Optional[datetime] = None
    mode: Optional[Literal["transcribe", "roleplay"]] = None
    scenario_id: Optional[str] = None
    scenario_text: Optional[str] = None
    speaker_id: Optional[int] = None
```

- [ ] **Step 3: Add `motor` to backend deps**

Open the backend dependency file (`backend/requirements.txt` or `pyproject.toml` — whichever is present). Append `motor==3.6.0`.

- [ ] **Step 4: Commit**

```bash
git add backend/db.py backend/models.py backend/requirements.txt
git commit -m "feat(backend): add motor client and session/message pydantic models"
```

---

## Task 15: Backend — sessions router

**Files:**
- Create: `backend/routes/__init__.py`
- Create: `backend/routes/sessions.py`

- [ ] **Step 1: Create the package init**

Create `backend/routes/__init__.py`:

```python
from .sessions import router as sessions_router

__all__ = ["sessions_router"]
```

- [ ] **Step 2: Create the router**

Create `backend/routes/sessions.py`:

```python
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from ..db import sessions
from ..models import MessageIn, SessionCreate, SessionPatch

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("")
async def create_session(body: SessionCreate) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "session_id": body.session_id,
        "started_at": now,
        "ended_at": None,
        "mode": "roleplay",
        "scenario_id": "sensei",
        "scenario_text": None,
        "speaker_id": None,
        "messages": [],
        "user_metadata": {},
    }
    await sessions().update_one(
        {"session_id": body.session_id},
        {"$setOnInsert": doc},
        upsert=True,
    )
    stored = await sessions().find_one({"session_id": body.session_id}, {"_id": 0})
    return stored


@router.get("/{session_id}")
async def get_session(session_id: str) -> dict:
    doc = await sessions().find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return doc


@router.patch("/{session_id}")
async def patch_session(session_id: str, body: SessionPatch) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        return await get_session(session_id)
    result = await sessions().update_one({"session_id": session_id}, {"$set": patch})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return await get_session(session_id)


@router.post("/{session_id}/messages")
async def append_message(session_id: str, body: MessageIn) -> dict:
    result = await sessions().update_one(
        {"session_id": session_id},
        {"$push": {"messages": body.model_dump()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"turn": body.turn}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/__init__.py backend/routes/sessions.py
git commit -m "feat(backend): add /sessions router with CRUD + message append"
```

---

## Task 16: Wire sessions router + health in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Read main.py**

Run: `cat backend/main.py`

- [ ] **Step 2: Import the router and db helpers, mount, extend health**

Add to imports at the top:

```python
from .db import ensure_indexes, ping as db_ping
from .routes import sessions_router
```

After the existing `app = FastAPI(...)` line, add:

```python
app.include_router(sessions_router)


@app.on_event("startup")
async def _startup() -> None:
    try:
        await ensure_indexes()
    except Exception as exc:  # non-fatal at startup; health endpoint will report
        print(f"[startup] ensure_indexes failed: {exc}")
```

Find the existing `/health` endpoint and extend its response. Replace its body with:

```python
@app.get("/health")
async def health() -> dict:
    chat_ready = bool(os.getenv("GEMINI_API_KEY"))
    tts_ready = bool(os.getenv("VOICEVOX_URL", "http://voicevox:50021"))
    db_ready = await db_ping()
    return {
        "status": "ok",
        "chatReady": chat_ready,
        "ttsReady": tts_ready,
        "dbReady": db_ready,
    }
```

(Adjust the `chat_ready` / `tts_ready` logic if the existing endpoint already does its own checks; the goal is to add `dbReady` to the response.)

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): mount sessions router and extend /health with dbReady"
```

---

## Task 17: Add `mongo` service to docker-compose files

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.server.yml`

- [ ] **Step 1: Read both compose files**

```bash
cat docker-compose.yml
echo "===="
cat docker-compose.server.yml
```

- [ ] **Step 2: Add a `mongo` service block to `docker-compose.yml`**

Append (matching existing indentation and quote style) under `services:`:

```yaml
  mongo:
    image: mongo:7
    container_name: stt-mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    ports:
      - "${MONGO_PORT:-27017}:27017"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

And at the bottom (next to any existing `volumes:` block) add:

```yaml
volumes:
  mongo_data:
```

- [ ] **Step 3: Add `MONGODB_URL` env to the backend service in `docker-compose.yml`**

In the backend service's `environment:` block, add:

```yaml
      - MONGODB_URL=mongodb://mongo:27017
```

- [ ] **Step 4: Apply the same changes to `docker-compose.server.yml`**

Mirror the mongo service, volume, and `MONGODB_URL` env added above. Skip if the file structure differs significantly — adapt to its existing patterns.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.server.yml
git commit -m "chore(docker): add mongo service and MONGODB_URL to backend"
```

---

## Task 18: Wire everything in page.tsx

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Read page.tsx and apply the wiring**

In [frontend/app/page.tsx](frontend/app/page.tsx), make the following changes:

1. Add imports near the top (after existing component imports):

```tsx
import { PlayCircle, StopCircle } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useSession } from "@/hooks/useSession";
```

2. Inside the `Home` function, after the `useMicrophone()` destructure, add:

```tsx
const { isRecording, duration, startRecording, stopRecording, hasPermission, permissionError, level } = useMicrophone();
const session = useSession(API_BASE);
const audioPlayback = useAudioPlayback(replyAudioUrl);
const audioLevelRef = useRef(0);

useEffect(() => {
  let raf = 0;
  const tick = () => {
    audioLevelRef.current = audioPlayback.isPlaying && audioPlayback.analyser
      ? (() => {
          const data = new Uint8Array(audioPlayback.analyser.frequencyBinCount);
          audioPlayback.analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          return Math.min(1, Math.sqrt(sum / data.length) * 4);
        })()
      : 0;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [audioPlayback.isPlaying, audioPlayback.analyser]);
```

3. Replace the `useEffect` that polls `/health` so the response is fed into both the existing `chatReady`/`ttsReady` state AND a new session-level `dbReady` is derived from `session.dbReady`.

4. Inside `handleStop`, after `setStatus("complete")` (both branches), add:

```tsx
if (session.sessionId) {
  void session.appendTurn({
    turn: history.length + 1,
    ts: Date.now(),
    user_text: uploadResult.text,
    language: uploadResult.language ?? "",
    audio_duration_ms: Math.round((uploadResult.duration ?? 0) * 1000),
    ai_reply_jp: mode === "roleplay" ? chatRes?.reply_jp ?? null : null,
    ai_reply_translation: mode === "roleplay" ? chatRes?.reply_translation ?? null : null,
    tts_speaker_id: mode === "roleplay" ? selectedSpeaker.id : null,
    audio_blob_ref: null,
    scenario_switched: false,
    error: null,
  });
}
```

(Refactor as needed so `chatRes` is in scope at this point. The current code calls `setHistory(chatRes.history)` — move the `appendTurn` call to immediately after.)

5. When scenario, mode, or speaker change, call `session.updateMeta(...)` via a `useEffect`:

```tsx
useEffect(() => {
  if (session.sessionId) {
    void session.updateMeta({
      mode,
      scenario_id: scenario.id,
      scenario_text: scenario.id === "custom" ? customScenario : null,
      speaker_id: selectedSpeaker.id,
    });
  }
}, [mode, scenario.id, customScenario, selectedSpeaker.id, session.sessionId]);
```

6. Above the `MicButton`, render the avatar in roleplay mode:

```tsx
{mode === "roleplay" && scenario.id !== "custom" && (
  <div className="my-6">
    <Avatar
      scenarioId={scenario.id}
      state={
        isRecording || status === "recording"
          ? "listening"
          : status === "speaking" && audioPlayback.isPlaying
            ? "speaking"
            : "idle"
      }
      size="lg"
      audioLevelRef={audioLevelRef}
    />
  </div>
)}
```

7. Replace the existing session-not-ready banner block with a `Start session` CTA when no session is active:

```tsx
{!session.ready ? null : session.sessionId ? null : (
  <div className="mb-6 flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm text-slate-700">Start a session to save your practice.</p>
    <button
      type="button"
      onClick={() => void session.start()}
      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-blue-700"
    >
      <PlayCircle className="h-4 w-4" /> Start session
    </button>
  </div>
)}
```

8. Add a small "End session" button to the footer when a session is active:

```tsx
{session.sessionId && (
  <button
    type="button"
    onClick={() => void session.end()}
    className="ml-3 inline-flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
  >
    <StopCircle className="h-3 w-3" /> End session
  </button>
)}
```

9. When `!session.dbReady`, render a soft warning banner above the MicButton:

```tsx
{!session.dbReady && (
  <div className="mb-4 w-full max-w-md rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
    ⚠️ Session is not persisting — MongoDB is unreachable. Your turns are still working; start a session once the database is back.
  </div>
)}
```

- [ ] **Step 2: Type-check the page**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(frontend): wire session, audio playback, and avatar into page"
```

---

## Task 19: Build, run, manual verify

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: clean build, no type errors.

- [ ] **Step 2: Start the stack**

Run: `docker compose -f docker-compose.yml up --build`
Expected: all services (mongo, backend, voicevox, frontend) start.

- [ ] **Step 3: Browser smoke test**

Open `http://localhost:3000` in a browser.

- [ ] **Step 4: Verify "Start session" CTA appears and works**

Click the CTA. Expected: CTA disappears, a session document is created in Mongo (`docker exec -it stt-mongo mongosh --eval "db.sessions.find().pretty()"`).

- [ ] **Step 5: Verify roleplay flow**

Pick a scenario card, record once, see avatar pulse, see bubble animate in. Verify a new entry appears in `messages[]` in Mongo.

- [ ] **Step 6: Verify refresh resume**

Reload the page. Expected: history rehydrates, scenario rehydrates, no "Start session" CTA.

- [ ] **Step 7: Verify "End session"**

Click "End session". Expected: `ended_at` set in Mongo, CTA reappears on next mount.

- [ ] **Step 8: Verify Mongo down graceful degradation**

Run: `docker compose stop mongo`
Expected: yellow banner appears; recording still works; turn persistence fails silently.

- [ ] **Step 9: Commit any post-verification fixes**

```bash
git add -A
git commit -m "chore: post-verification fixes" || true
```

---

## Self-Review

**1. Spec coverage:**
- Light theme tokens → Task 1, 2.
- Avatar system (8 SVGs, state machine) → Tasks 4, 5, 18.
- Interactive surfaces (mic, scenario cards, chat bubbles, status) → Tasks 9, 10, 11, 12, 18.
- Per-message audio → Tasks 6, 8, 11, 18.
- TTS playback hook with analyser → Task 6.
- MongoDB persistence → Tasks 14, 15, 16, 17, 18.
- `useSession` (explicit start/end, resumable, graceful degradation) → Tasks 13, 18.
- Light error/warn banners → Task 12 (StatusIndicator) + Task 18 (banners).
- Testing matrix → Task 19.

**2. Placeholder scan:** No "TBD" / "TODO" / "fill in details" in any step. All code blocks contain complete content.

**3. Type consistency:**
- `AvatarProps` (with `size?: number`) referenced by all 8 avatar files and exported from `Avatar.tsx`.
- `AvatarComponentProps` (with `scenarioId`, `state`, `size`, `audioLevelRef`, `className`) exported and used by page.tsx.
- `SessionDoc`, `SessionTurn` from `api.ts` consumed by `useSession.ts` and `page.tsx`.
- `useAudioPlayback` return type `{ isPlaying, play, stop, analyser }` matches usage in page.tsx.
- `chatRes` is referenced inside `handleStop`; the current page.tsx defines it locally. The wiring step (Task 18) calls `appendTurn` immediately after `setHistory(chatRes.history)` to keep it in scope.
- `MessageIn` (backend) and `SessionTurn` (frontend) field names match exactly.

**4. No gaps found.**
