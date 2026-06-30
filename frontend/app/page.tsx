"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  AppMode,
  ChatMessage,
  ChatScenario,
  CUSTOM_SCENARIO_ID,
  DEFAULT_SPEAKERS,
  PRESET_SCENARIOS,
  Speaker,
  TranscriptionStatus,
} from "@/types/audio";
import { chatClient, transcriptionClient, ttsClient } from "@/services/api";
import MicButton from "@/components/MicButton";
import ResultCard from "@/components/ResultCard";
import StatusIndicator from "@/components/StatusIndicator";
import DurationBar from "@/components/DurationBar";
import ScenarioPicker from "@/components/ScenarioPicker";
import SpeakerPicker from "@/components/SpeakerPicker";
import ChatHistory from "@/components/ChatHistory";
import { useMicrophone } from "@/hooks/useMicrophone";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  // Mode + scenario state
  const [mode, setMode] = useState<AppMode>("transcribe");
  const [scenario, setScenario] = useState<ChatScenario>(PRESET_SCENARIOS[0]);
  const [customScenario, setCustomScenario] = useState<string>("");

  // TTS (VOICEVOX) state
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker>(DEFAULT_SPEAKERS[0]);
  const [ttsReady, setTtsReady] = useState<boolean>(false);
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  // Conversation history (persists for the session in roleplay mode)
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [lastTranslation, setLastTranslation] = useState<string | null>(null);

  // Transcription state
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [resultText, setResultText] = useState<string>("");
  const [resultDuration, setResultDuration] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [language, setLanguage] = useState<string>("");

  // Server health (chat + TTS readiness)
  const [chatReady, setChatReady] = useState<boolean>(false);

  const recordingStartTime = useRef<number>(0);

  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    hasPermission,
    permissionError,
  } = useMicrophone();

  // Sync microphone error with component error
  useEffect(() => {
    if (permissionError) {
      setError(permissionError);
    }
  }, [permissionError]);

  // Poll /health so the "service belum siap" banners clear automatically once
  // the backend (or VOICEVOX engine) comes up after a rebuild. Probes every
  // 10 s while the tab is visible, and re-probes on focus / visibilitychange
  // so a rebuild in another terminal is reflected without a hard refresh.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const h = await transcriptionClient.health(API_BASE);
        if (cancelled) return;
        setChatReady(h.chatReady);
        setTtsReady(h.ttsReady);
      } catch {
        if (!cancelled) {
          setChatReady(false);
          setTtsReady(false);
        }
      }
    };
    void probe();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void probe();
    }, 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void probe();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Fetch VOICEVOX speakers on mount. Failures are non-fatal — we fall back
  // to DEFAULT_SPEAKERS in the SpeakerPicker.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await ttsClient.listSpeakers(API_BASE);
        if (cancelled) return;
        setSpeakers(list);
        // If the default speaker (id=2) isn't in the engine's list, keep
        // the first engine entry as the selection so the user always has a
        // valid speaker.
        if (list.length > 0 && !list.some((s) => s.id === selectedSpeaker.id)) {
          setSelectedSpeaker(list[0]);
        }
      } catch {
        if (!cancelled) setSpeakers([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // selectedSpeaker.id is intentionally not a dep — we only re-run if the
    // speaker list itself changes (it never does after mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup any blob URL we created for the previous reply, and on unmount.
  useEffect(() => {
    return () => {
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
    };
  }, []);

  // When mode flips to transcribe, drop any in-flight roleplay state
  const handleModeChange = useCallback((next: AppMode) => {
    setMode(next);
    setError("");
  }, []);

  const handleStart = useCallback(async () => {
    setError("");
    setResultText("");
    setStatus("recording");
    recordingStartTime.current = Date.now();

    try {
      await startRecording();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start recording";
      setError(msg);
      setStatus("error");
    }
  }, [startRecording]);

  const handleStop = useCallback(async () => {
    let blob: Blob | null = null;

    try {
      blob = await stopRecording();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to stop recording";
      setError(msg);
      setStatus("idle");
      return;
    }

    if (!blob || blob.size === 0) {
      setError("Recording is empty. Please try again.");
      setStatus("error");
      return;
    }

    setStatus("uploading");

    // 1) STT (used by both modes — always show the transcribed text)
    let uploadResult;
    try {
      uploadResult = await transcriptionClient.upload(blob, API_BASE);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during upload";
      setError(msg);
      setStatus("error");
      return;
    }

    if (!uploadResult.success) {
      setError(uploadResult.error ?? "Transcription failed");
      setStatus("error");
      return;
    }

    setResultText(uploadResult.text);
    setResultDuration(uploadResult.duration ?? 0);
    setLanguage(uploadResult.language ?? "");

    // 2) If in roleplay mode, send the transcribed text to the LLM
    if (mode === "roleplay") {
      if (!chatReady) {
        setError("Chat service is not ready. Set GEMINI_API_KEY on the backend and restart.");
        setStatus("error");
        return;
      }
      setStatus("chatting");

      const effectiveScenario =
        scenario.id === CUSTOM_SCENARIO_ID ? customScenario.trim() : scenario.description;

      if (scenario.id === CUSTOM_SCENARIO_ID && !effectiveScenario) {
        setError("Please enter a custom scenario description first.");
        setStatus("error");
        return;
      }

      let chatRes;
      try {
        chatRes = await chatClient.send(
          {
            user_text: uploadResult.text,
            scenario: effectiveScenario,
            history,
          },
          API_BASE,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Chat call failed";
        setError(msg);
        setStatus("error");
        return;
      }

      setHistory(chatRes.history);
      setLastTranslation(chatRes.reply_translation || null);

      // 3) Synthesise the Japanese reply → audio. Failure is non-fatal —
      //    text reply is still shown, just without audio.
      if (ttsReady && chatRes.reply_jp) {
        try {
          setStatus("speaking");
          const audioBlob = await ttsClient.synthesise(
            { text: chatRes.reply_jp, speaker: selectedSpeaker.id },
            API_BASE,
          );
          if (lastBlobUrlRef.current) {
            URL.revokeObjectURL(lastBlobUrlRef.current);
          }
          const url = URL.createObjectURL(audioBlob);
          lastBlobUrlRef.current = url;
          setReplyAudioUrl(url);
        } catch (err) {
          // TTS failed — log to console, keep the text reply, drop the audio.
          console.warn("TTS failed:", err);
          setReplyAudioUrl(null);
        }
      } else {
        setReplyAudioUrl(null);
      }

      setStatus("complete");
      return;
    }

    // Transcribe-only path
    setStatus("complete");
  }, [stopRecording, mode, chatReady, ttsReady, scenario, customScenario, history, selectedSpeaker.id]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setLastTranslation(null);
    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
      lastBlobUrlRef.current = null;
    }
    setReplyAudioUrl(null);
  }, []);

  const getStatusLabel = (): string => {
    switch (status) {
      case "idle":
        return "Idle";
      case "recording":
        return "Recording";
      case "uploading":
        return "Uploading";
      case "transcribing":
        return "Transcribing";
      case "chatting":
        return "AI is replying…";
      case "speaking":
        return "Speaking…";
      case "complete":
        return "Complete";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  // Effective scenario description for display in the LLM call
  const scenarioDescription =
    scenario.id === CUSTOM_SCENARIO_ID ? customScenario : scenario.description;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
          日本語音声認識
        </h1>
        <p className="text-[var(--text-secondary)]">
          Japanese Speech-to-Text & Roleplay — Faster-Whisper Medium + Gemini + VOICEVOX
        </p>
        <div className="mt-2 text-xs text-[var(--text-secondary)]/60">
          Powered by local GPU inference
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 text-xs">
        <button
          type="button"
          onClick={() => handleModeChange("transcribe")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            mode === "transcribe"
              ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
              : "text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)]"
          }`}
        >
          🎙️ Transcribe
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("roleplay")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            mode === "roleplay"
              ? "bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]"
              : "text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)]"
          }`}
        >
          💬 Roleplay (Guru Jepang)
        </button>
      </div>

      {/* Roleplay-only controls */}
      {mode === "roleplay" && (
        <>
          <ScenarioPicker
            selected={scenario}
            onChange={(s) =>
              setScenario({
                ...s,
                // If switching away from custom, keep custom text in memory
                description: s.id === CUSTOM_SCENARIO_ID ? customScenario : s.description,
              })
            }
            customText={customScenario}
            onCustomTextChange={(t) => {
              setCustomScenario(t);
              // If currently in custom mode, also reflect into the active scenario
              if (scenario.id === CUSTOM_SCENARIO_ID) {
                setScenario((prev) => ({ ...prev, description: t }));
              }
            }}
          />
          <SpeakerPicker
            selected={selectedSpeaker}
            onChange={setSelectedSpeaker}
            available={speakers}
            disabled={!ttsReady}
          />
          {!chatReady && (
            <div className="mb-2 w-full max-w-md rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-400">
              ⚠️ Chat service belum siap — pastikan <code>GEMINI_API_KEY</code> di-set di backend.
            </div>
          )}
          {!ttsReady && (
            <div className="mb-4 w-full max-w-md rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs text-blue-400">
              🔇 VOICEVOX engine belum siap — balasan AI hanya teks. Jalankan engine di <code>VOICEVOX_URL</code> untuk audio.
            </div>
          )}
        </>
      )}

      {/* Status Indicator */}
      <StatusIndicator
        status={status}
        label={getStatusLabel()}
        isRecording={isRecording}
      />

      {/* Mic Button */}
      <div className="my-8">
        <MicButton
          isRecording={isRecording}
          hasPermission={hasPermission}
          onStart={handleStart}
          onStop={handleStop}
        />
      </div>

      {/* Duration Bar */}
      {(isRecording || status === "recording") && (
        <div className="mb-8 w-full max-w-md">
          <DurationBar duration={duration} isActive={isRecording} />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 w-full max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Result Card — always shown after a successful turn */}
      {(status === "complete" || status === "error") && resultText && (
        <div className="w-full max-w-md">
          <ResultCard
            text={resultText}
            duration={resultDuration}
            language={language}
            isError={status === "error"}
          />
        </div>
      )}

      {/* Roleplay chat history */}
      {mode === "roleplay" && (
        <div className="mt-6 flex w-full max-w-md flex-col items-center">
          <div className="mb-2 flex w-full items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]/70">
              Conversation ({history.length} turn{history.length === 1 ? "" : "s"})
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs text-[var(--text-secondary)]/60 underline-offset-2 hover:text-red-400 hover:underline"
              >
                Clear conversation
              </button>
            )}
          </div>
          <ChatHistory
            messages={history}
            lastTranslation={lastTranslation}
            audioForLastReply={replyAudioUrl}
          />
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-[var(--text-secondary)]/40">
        <p>
          {mode === "transcribe"
            ? "Press the mic → speak Japanese → get instant transcription"
            : `Pilih skenario → pilih speaker → tekan mic → bicara dalam bahasa Jepang → AI akan membalas dengan suara (Skenario aktif: ${scenarioDescription || "(belum diisi)"})`}
        </p>
      </footer>
    </main>
  );
}
