"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, X, Mic, MicOff } from "lucide-react";
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
import { chatClient, SessionTurn, transcriptionClient, ttsClient } from "@/services/api";
import TalkingMigu, { MiguEmotion } from "@/components/TalkingMigu";
import RoomBackground from "@/components/RoomBackground";
import SettingsDrawer from "@/components/SettingsDrawer";
import HistoryDrawer from "@/components/HistoryDrawer";
import MicStage from "@/components/MicStage";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useMiguReactions } from "@/hooks/useMiguReactions";
import { useSessionContext } from "@/components/SessionProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MiguPage() {
  // Mode + scenario state
  const [mode, setMode] = useState<AppMode>("transcribe");
  const [scenario, setScenario] = useState<ChatScenario>(PRESET_SCENARIOS[0]);
  const [customScenario, setCustomScenario] = useState<string>("");

  // Settings state
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [jpLevel, setJpLevel] = useState<"basic" | "intermediate" | "hard">("intermediate");
  const [maxTurns, setMaxTurns] = useState<number>(10);

  // TTS state
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker>(DEFAULT_SPEAKERS[0]);
  const [ttsReady, setTtsReady] = useState<boolean>(false);
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  // Conversation history
  const [history, setHistory] = useState<ChatMessage[]>([]);

  // Transcription state
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [resultDuration, setResultDuration] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [language, setLanguage] = useState<string>("");

  // Server health
  const [chatReady, setChatReady] = useState<boolean>(false);

  // UI state
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);

  const session = useSessionContext();
  const migu = useMiguReactions();
  const audioLevelRef = useRef<number>(0);

  const {
    isRecording,
    startRecording,
    stopRecording,
    hasPermission,
    permissionError,
    level,
    mediaDevicesSupported,
  } = useMicrophone();

  // Pipe mic level into the Migu mouth and emotion
  useEffect(() => {
    audioLevelRef.current = level;
  }, [level]);

  useEffect(() => {
    if (permissionError) setError(permissionError);
  }, [permissionError]);

  // Health polling
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

  // Speakers
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await ttsClient.listSpeakers(API_BASE);
        if (cancelled) return;
        setSpeakers(list);
        const prevLabel = selectedSpeaker.label;
        const match = list.find(
          (s) => s.label === prevLabel || `${s.name} — ${s.style}` === prevLabel
        );
        if (match) {
          setSelectedSpeaker(match);
        }
      } catch {
        if (!cancelled) setSpeakers([]);
      }
    };
    void load();
    return () => { cancelled = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate session
  useEffect(() => {
    const doc = session.hydrated;
    if (!doc) return;
    if (doc.messages.length === 0) return;
    setHistory(
      doc.messages
        .filter((m) => m.ai_reply_jp)
        .map((m): ChatMessage => ({
          role: m.user_text ? "user" : "model",
          text: m.user_text || m.ai_reply_jp || "",
          translation: m.ai_reply_translation ?? undefined,
          audioUrl: undefined,
          ts: m.ts,
        })),
    );
    if (doc.mode === "roleplay" || doc.mode === "transcribe") {
      setMode(doc.mode);
    }
    if (doc.scenario_id) {
      const match = PRESET_SCENARIOS.find((s) => s.id === doc.scenario_id);
      if (match) setScenario(match);
      else if (doc.scenario_id === CUSTOM_SCENARIO_ID && doc.scenario_text) {
        setCustomScenario(doc.scenario_text);
        setScenario({ id: CUSTOM_SCENARIO_ID, label: "Custom", description: doc.scenario_text });
      }
    }
    if (doc.speaker_id != null) {
      const found = DEFAULT_SPEAKERS.find((s) => s.id === doc.speaker_id)
        ?? speakers.find((s) => s.id === doc.speaker_id);
      if (found) setSelectedSpeaker(found);
    }
    if (doc.tts_speed != null) setTtsSpeed(doc.tts_speed);
    if (doc.jp_level) setJpLevel(doc.jp_level);
    if (doc.max_turns != null) setMaxTurns(doc.max_turns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.hydrated?.session_id, speakers]);

  // Persist meta
  useEffect(() => {
    if (!session.sessionId) return;
    const patch: Partial<{
      mode: AppMode;
      scenario_id: string;
      scenario_text: string | null;
      speaker_id: number | null;
      tts_speed: number;
      jp_level: "basic" | "intermediate" | "hard";
      max_turns: number;
    }> = {
      mode,
      scenario_id: scenario.id,
      scenario_text: scenario.id === CUSTOM_SCENARIO_ID ? scenario.description : null,
      speaker_id: selectedSpeaker.id,
      tts_speed: ttsSpeed,
      jp_level: jpLevel,
      max_turns: maxTurns,
    };
    void session.updateMeta(patch);
  }, [session.sessionId, mode, scenario.id, scenario.description, selectedSpeaker.id, ttsSpeed, jpLevel, maxTurns, session]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
    };
  }, []);

  const playBlob = useCallback((url: string) => {
    const audio = new Audio(url);
    audio.play().catch((err) => console.warn("Audio play failed:", err));
  }, []);

  const handleStart = useCallback(async () => {
    setError("");
    setTranscribedText("");
    setStatus("recording");
    migu.listen();
    try {
      await startRecording();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start recording";
      setError(msg);
      setStatus("error");
      migu.reset();
    }
  }, [startRecording, migu]);

  const handleStop = useCallback(async () => {
    migu.doneListening();

    let blob: Blob | null = null;
    try {
      blob = await stopRecording();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to stop recording";
      setError(msg);
      setStatus("idle");
      migu.reset();
      return;
    }

    if (!blob || blob.size === 0) {
      setError("Recording is empty. Please try again.");
      setStatus("error");
      migu.reset();
      return;
    }

    setStatus("uploading");

    let uploadResult;
    try {
      uploadResult = await transcriptionClient.upload(blob, API_BASE);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during upload";
      setError(msg);
      setStatus("error");
      migu.reset();
      return;
    }

    if (!uploadResult.success) {
      setError(uploadResult.error ?? "Transcription failed");
      setStatus("error");
      migu.reset();
      return;
    }

    setTranscribedText(uploadResult.text);
    setResultDuration(uploadResult.duration ?? 0);
    setLanguage(uploadResult.language ?? "");
    migu.showSpeech(uploadResult.text, 4000);

    if (!session.sessionId) {
      await session.start();
    }

    if (mode === "transcribe") {
      setStatus("speaking");
      migu.speak();
      if (ttsReady && uploadResult.text) {
        try {
          const audioBlob = await ttsClient.synthesise(
            { text: uploadResult.text, speaker: selectedSpeaker.id, speed: ttsSpeed },
            API_BASE,
          );
          if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
          const url = URL.createObjectURL(audioBlob);
          lastBlobUrlRef.current = url;
          setReplyAudioUrl(url);
          playBlob(url);
        } catch {
          setReplyAudioUrl(null);
        }
      }
      setStatus("complete");
      migu.love();
      const turn: SessionTurn = {
        turn: 1,
        ts: Math.floor(Date.now() / 1000),
        user_text: uploadResult.text,
        language: uploadResult.language ?? "",
        audio_duration_ms: Math.round((uploadResult.duration ?? 0) * 1000),
        ai_reply_jp: null,
        ai_reply_translation: null,
        tts_speaker_id: null,
        audio_blob_ref: null,
        scenario_switched: false,
        error: null,
      };
      void session.appendTurn(turn);
      return;
    }

    // Roleplay mode
    if (!chatReady) {
      setError("Chat service is not ready. Set OPENAI_BASE_URL on the backend.");
      setStatus("error");
      migu.reset();
      return;
    }
    setStatus("chatting");

    const effectiveScenario =
      scenario.id === CUSTOM_SCENARIO_ID ? customScenario.trim() : scenario.description;

    if (scenario.id === CUSTOM_SCENARIO_ID && !effectiveScenario) {
      setError("Please enter a custom scenario description first.");
      setStatus("error");
      migu.reset();
      return;
    }

    let chatRes;
    try {
      chatRes = await chatClient.send(
        {
          user_text: uploadResult.text,
          scenario: effectiveScenario,
          history,
          jp_level: jpLevel as "basic" | "intermediate" | "hard",
          max_turns: maxTurns,
        },
        API_BASE,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chat call failed";
      setError(msg);
      setStatus("error");
      migu.reset();
      return;
    }

    setHistory(chatRes.history);
    migu.showSpeech(chatRes.reply_jp, 5000);

    if (ttsReady && chatRes.reply_jp) {
      setStatus("speaking");
      migu.speak();
      try {
        const audioBlob = await ttsClient.synthesise(
          { text: chatRes.reply_jp, speaker: selectedSpeaker.id, speed: ttsSpeed },
          API_BASE,
        );
        if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
        const url = URL.createObjectURL(audioBlob);
        lastBlobUrlRef.current = url;
        setReplyAudioUrl(url);
        playBlob(url);
      } catch {
        setReplyAudioUrl(null);
      }
    }

    setStatus("complete");
    migu.love();
    const turn: SessionTurn = {
      turn: chatRes.history.length,
      ts: Math.floor(Date.now() / 1000),
      user_text: uploadResult.text,
      language: uploadResult.language ?? "",
      audio_duration_ms: Math.round((uploadResult.duration ?? 0) * 1000),
      ai_reply_jp: chatRes.reply_jp,
      ai_reply_translation: chatRes.reply_translation || null,
      tts_speaker_id: selectedSpeaker.id,
      audio_blob_ref: null,
      scenario_switched: false,
      error: null,
    };
    void session.appendTurn(turn);
  }, [
    stopRecording,
    mode,
    chatReady,
    ttsReady,
    scenario,
    customScenario,
    history,
    selectedSpeaker.id,
    migu,
    session,
    playBlob,
  ]);

  const effectiveEmotion: MiguEmotion = (() => {
    if (status === "recording") return "listening";
    if (status === "speaking") return "talking";
    if (status === "uploading" || status === "transcribing" || status === "chatting") return "thinking";
    return migu.emotion;
  })();

  const effectiveSpeech = migu.speechText || transcribedText;
  const denied = hasPermission === false;

  const onMiguHead = useCallback(() => migu.handleTapHead(), [migu]);
  const onMiguBelly = useCallback(() => migu.handleTapBelly(), [migu]);
  const onMiguBeak = useCallback(() => migu.handleTapBeak(), [migu]);
  const onMiguWing = useCallback(() => migu.handleTapWing(), [migu]);
  const onMiguFoot = useCallback(() => migu.handleTapFoot(), [migu]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <RoomBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-4 pb-safe pt-safe md:max-w-2xl md:px-6 md:pb-40">
        {/* Top bar */}
        <div className="flex w-full items-center justify-between">
          <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm backdrop-blur">
            Migu - 日本語
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow backdrop-blur transition hover:bg-white"
            aria-label="Settings"
          >
            {settingsOpen ? <X className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
          </button>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            Bicara dengan Migu
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Migu akan mengulang katamu. Sentuh dia untuk berinteraksi.
          </p>
        </div>

        {/* Settings drawer */}
        <SettingsDrawer
          open={settingsOpen}
          mode={mode}
          scenario={scenario}
          customScenario={customScenario}
          speakers={speakers}
          selectedSpeaker={selectedSpeaker}
          ttsSpeed={ttsSpeed}
          jpLevel={jpLevel}
          maxTurns={maxTurns}
          chatReady={chatReady}
          ttsReady={ttsReady}
          onModeChange={setMode}
          onScenarioChange={(s) =>
            setScenario({
              ...s,
              description: s.id === CUSTOM_SCENARIO_ID ? customScenario : s.description,
            })
          }
          onCustomScenarioChange={(t) => {
            setCustomScenario(t);
            if (scenario.id === CUSTOM_SCENARIO_ID) {
              setScenario((prev) => ({ ...prev, description: t }));
            }
          }}
          onSpeakerChange={setSelectedSpeaker}
          onTtsSpeedChange={setTtsSpeed}
          onJpLevelChange={setJpLevel}
          onMaxTurnsChange={setMaxTurns}
        />

        {/* Migu stage */}
        <div className="mt-6 flex w-full flex-1 flex-col items-center justify-center">
          <TalkingMigu
            emotion={effectiveEmotion}
            size={320}
            audioLevelRef={audioLevelRef}
            speechText={effectiveSpeech}
            onTapHead={onMiguHead}
            onTapBelly={onMiguBelly}
            onTapBeak={onMiguBeak}
            onTapWing={onMiguWing}
            onTapFoot={onMiguFoot}
          />

          {/* Status + error + result + history toggle */}
          <MicStage
            status={status}
            error={error}
            transcribedText={transcribedText}
            replyAudioUrl={replyAudioUrl}
            mode={mode}
            historyOpen={historyOpen}
            onReplay={() => replyAudioUrl && playBlob(replyAudioUrl)}
            onToggleHistory={() => setHistoryOpen((v) => !v)}
          />

          {/* Error notification */}
          {error && (
            <div className="mt-3 w-full max-w-sm rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Result text (last transcription) */}
          {transcribedText && mode === "transcribe" && status === "complete" && (
            <div className="mt-4 w-full max-w-sm rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-slate-800 shadow-sm backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Kamu bilang
              </div>
              <div className="mt-1 leading-relaxed">{transcribedText}</div>
            </div>
          )}

          {/* History peek */}
          {mode === "roleplay" && history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              {historyOpen ? "Sembunyikan" : "Lihat"} riwayat ({history.length})
            </button>
          )}
        </div>

        {/* Bottom mic button */}
        <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            disabled={denied}
            onClick={isRecording ? handleStop : handleStart}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl transition-all focus:outline-none focus:ring-4 ${
              denied
                ? "cursor-not-allowed bg-red-900/60"
                : isRecording
                  ? "scale-110 bg-red-500 focus:ring-red-300"
                  : "bg-gradient-to-br from-amber-400 to-amber-600 hover:scale-105 focus:ring-amber-300"
            }`}
            aria-label={isRecording ? "Stop" : "Record"}
          >
            {isRecording && (
              <>
                {[0, 0.5, 1].map((delay) => (
                  <motion.span
                    key={delay}
                    className="absolute inset-0 rounded-full border-4 border-red-300"
                    initial={{ opacity: 0, scale: 1 }}
                    animate={{ opacity: [0, 0.7, 0], scale: [1, 1.3, 1.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay }}
                  />
                ))}
              </>
            )}
            {denied ? (
              <MicOff className="h-8 w-8" />
            ) : isRecording ? (
              <span className="block h-6 w-6 rounded-sm bg-white" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
          <div className="mt-2 text-center text-[11px] font-medium text-slate-600">
            {denied ? "Izin mikrofon ditolak" : isRecording ? "Tekan untuk berhenti" : "Tekan untuk bicara"}
          </div>
        </div>
      </div>

      {/* Mic permission error notification */}
      {(permissionError || !mediaDevicesSupported) && (
        <div className="mx-auto mt-4 w-full max-w-sm animate-pulse rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-red-700">Mikrofon tidak bisa digunakan</p>
          <p className="mt-1 text-xs text-red-600">
            {permissionError ??
              "Browser Anda tidak mendukung akses mikrofon. Pastikan kamu membuka halaman ini melalui HTTPS atau localhost."}
          </p>
        </div>
      )}

      {/* History drawer */}
      <HistoryDrawer
        open={historyOpen && mode === "roleplay" && history.length > 0}
        history={history}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
