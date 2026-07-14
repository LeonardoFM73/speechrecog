/** TypeScript type definitions for the frontend. */

// Transcription statuses used throughout the UI
export type TranscriptionStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing"
  | "chatting"
  | "speaking"
  | "complete"
  | "error";

// Application mode (single-page has two workflows)
export type AppMode = "transcribe" | "roleplay";

// Result returned from the backend API
export interface TranscriptionResult {
  success: boolean;
  text: string;
  duration: number;
  language: string;
  error: string | null;
}

// Health-check response from the backend
export interface HealthStatus {
  status: string;
  gpu: string;
  model_loaded: boolean;
  chat_ready?: boolean;
  tts_ready?: boolean;
  db_ready?: boolean;
}

// ---------------------------------------------------------------------------
// Roleplay chat types
// ---------------------------------------------------------------------------
export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
  translation?: string;
  audioUrl?: string;
  ts?: number;
}

export interface ChatScenario {
  id: string;
  label: string;        // shown in UI
  description: string;  // sent to LLM as the scenario system context
}

export const PRESET_SCENARIOS: ChatScenario[] = [
  {
    id: "taxi_station",
    label: "Supir Taksi di Stasiun 🚕",
    description:
      "あなたは東京でタクシーの運転手です。ユーザーが今、主要な駅でタクシーを探しています。",
  },
  {
    id: "convenience_store",
    label: "Di Minimarket 🏪",
    description:
      "あなたはコンビニの店員です。ユーザーが商品を探しています。",
  },
  {
    id: "restaurant",
    label: "Di Restoran 🍜",
    description:
      "あなたはレストランのウェイターです。ユーザーが注文しようとしています。",
  },
  {
    id: "train_station",
    label: "Di Loket Tiket 🚆",
    description:
      "あなたは駅の窓口係員です。ユーザーが切符を買おうとしています。",
  },
  {
    id: "doctor",
    label: "Di Dokter 🏥",
    description:
      "あなたは医者です。ユーザーが症状を説明しに来ました。",
  },
];

export const CUSTOM_SCENARIO_ID = "custom";

// ---------------------------------------------------------------------------
// TTS (VOICEVOX) types
// ---------------------------------------------------------------------------

/** One (character, style) pair returned by VOICEVOX /speakers. */
export interface Speaker {
  id: number;
  name: string;     // character name, e.g. "四国めたん"
  style: string;    // style name, e.g. "ノーマル"
  label: string;    // UI label, e.g. "四国めたん — ノーマル"
}

/** Request body for POST /tts. */
export interface TtsRequest {
  text: string;
  speaker?: number | null; // null/undefined = use backend default
}

/**
 * Fallback speakers used when /speakers hasn't loaded or the VOICEVOX engine
 * is unreachable. Mirrors popular VOICEVOX defaults — the user can still
 * switch in the UI once /speakers responds.
 */
export const DEFAULT_SPEAKERS: Speaker[] = [
  { id: 2,  name: "四国めたん",   style: "あまあま", label: "四国めたん — あまあま" },
  { id: 3,  name: "ずんだもん",   style: "ノーマル", label: "ずんだもん — ノーマル" },
  { id: 8,  name: "春日��つむぎ", style: "ノーマル", label: "春日部つむぎ — ノーマル" },
  { id: 27, name: "九州そら",     style: "ノーマル", label: "九州そら — ノーマル" },
  { id: 12, name: "雨晴はう",     style: "ノーマル", label: "雨晴はう — ノーマル" },
];
