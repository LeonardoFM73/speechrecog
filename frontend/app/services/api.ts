/** API client for the transcription + chat + TTS backend. */

import { ChatMessage, Speaker, TranscriptionResult, TtsRequest } from "@/types/audio";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------
/**
 * Upload an audio blob to the backend for transcription.
 */
export async function uploadAudio(
  audioBlob: Blob,
  baseUrl: string,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(`${baseUrl}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as Record<string, unknown>;
      throw new ApiError(
        response.status,
        (typeof json.detail === "string" ? json.detail : "Request failed") as string,
      );
    }
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as TranscriptionResult;
  return data;
}

/**
 * Check backend health / GPU status.
 */
export async function checkHealth(baseUrl: string): Promise<{
  status: string;
  gpu: string;
  modelLoaded: boolean;
  chatReady: boolean;
  ttsReady: boolean;
}> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new ApiError(response.status, `Health check failed: ${response.statusText}`);
  }
  const data = (await response.json()) as {
    status: string;
    gpu: string;
    model_loaded: boolean;
    chat_ready?: boolean;
    tts_ready?: boolean;
  };
  return {
    status: data.status,
    gpu: data.gpu,
    modelLoaded: data.model_loaded,
    chatReady: data.chat_ready ?? false,
    ttsReady: data.tts_ready ?? false,
  };
}

/** Named export alias to match imports from the UI */
export const transcriptionClient = {
  upload: uploadAudio,
  health: checkHealth,
};

// ---------------------------------------------------------------------------
// Chat (roleplay LLM)
// ---------------------------------------------------------------------------
export interface ChatRequest {
  user_text: string;
  scenario: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  reply_jp: string;
  reply_translation: string;
  history: ChatMessage[];
  error: string | null;
}

/**
 * Send the user's transcribed text + scenario + history to the LLM backend.
 * Returns the Japanese reply, Indonesian translation, and the full updated history.
 */
export async function sendChat(
  payload: ChatRequest,
  baseUrl: string,
): Promise<ChatResponse> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as Record<string, unknown>;
      throw new ApiError(
        response.status,
        (typeof json.detail === "string" ? json.detail : "Chat request failed") as string,
      );
    }
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as ChatResponse;
}

export const chatClient = { send: sendChat };

// ---------------------------------------------------------------------------
// TTS (VOICEVOX)
// ---------------------------------------------------------------------------

/** Fetch all available VOICEVOX speakers from the backend. */
export async function fetchSpeakers(baseUrl: string): Promise<Speaker[]> {
  const response = await fetch(`${baseUrl}/speakers`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to fetch speakers: ${response.statusText}`);
  }
  const data = (await response.json()) as { speakers: Speaker[] };
  return data.speakers;
}

/**
 * Synthesise Japanese text to WAV audio via the backend /tts proxy.
 * Returns a Blob (audio/wav) that the caller should turn into a blob: URL.
 */
export async function synthesiseSpeech(
  payload: TtsRequest,
  baseUrl: string,
): Promise<Blob> {
  const response = await fetch(`${baseUrl}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let msg = `TTS failed (${response.status})`;
    try {
      const json = (await response.json()) as Record<string, unknown>;
      if (typeof json.detail === "string") {
        msg = json.detail as string;
      }
    } catch {
      // ignore — keep generic message
    }
    throw new ApiError(response.status, msg);
  }

  return response.blob(); // audio/wav
}

export const ttsClient = {
  listSpeakers: fetchSpeakers,
  synthesise: synthesiseSpeech,
};
