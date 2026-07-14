"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, ChevronUp, Mic, MicOff, Volume2 } from "lucide-react";
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
import ScenarioPicker from "@/components/ScenarioPicker";
import SpeakerPicker from "@/components/SpeakerPicker";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useMiguReactions } from "@/hooks/useMiguReactions";
import { useSessionContext } from "@/components/SessionProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MiguPage() {
  // Mode + scenario state
  const [mode, setMode] = useState<AppMode>("transcribe");
  const [scenario, setScenario] = useState<ChatScenario>(PRESET_SCENARIOS[0]);
  const [customScenario, setCustomScenario] = useState<string>("");

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
  const [resultText, setResultText] = useState<string>("");
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
    duration,
    startRecording,
    stopRecording,
    hasPermission,
    permissionError,
    level,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate session
  useEffect(() => {
    const doc = session.hydrated;
    if (!doc) return;
    if (doc.messages.length === 0) return;
    setHistory(
      doc.messages.map((m): ChatMessage => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.hydrated?.session_id]);

  // Persist meta
  useEffect(() => {
    if (!session.sessionId) return;
    const patch: Partial<{
      mode: AppMode;
      scenario_id: string;
      scenario_text: string | null;
      speaker_id: number | null;
    }> = {
      mode,
      scenario_id: scenario.id,
      scenario_text: scenario.id === CUSTOM_SCENARIO_ID ? scenario.description : null,
      speaker_id: selectedSpeaker.id,
    };
    void session.updateMeta(patch);
  }, [session.sessionId, mode, scenario.id, scenario.description, selectedSpeaker.id, session]);

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
    setResultText("");
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

    setResultText(uploadResult.text);
    setResultDuration(uploadResult.duration ?? 0);
    setLanguage(uploadResult.language ?? "");
    migu.showSpeech(uploadResult.text, 4000);

    if (!session.sessionId) {
      await session.start();
    }

    // Transcribe-only mode: Migu repeats text via TTS if available
    if (mode === "transcribe") {
      setStatus("speaking");
      migu.speak();
      if (ttsReady && uploadResult.text) {
        try {
          const audioBlob = await ttsClient.synthesise(
            { text: uploadResult.text, speaker: selectedSpeaker.id },
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
      setError("Chat service is not ready. Set GEMINI_API_KEY on the backend.");
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
          { text: chatRes.reply_jp, speaker: selectedSpeaker.id },
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

  // Map app status to Migu emotion (only when not actively reacting)
  const effectiveEmotion: MiguEmotion = (() => {
    if (status === "recording") return "listening";
    if (status === "speaking") return "talking";
    if (status === "uploading" || status === "transcribing" || status === "chatting") return "thinking";
    return migu.emotion;
  })();

  const effectiveSpeech = migu.speechText || resultText;

  const denied = hasPermission === false;

  // Migu tap handlers
  const onMiguHead = useCallback(() => migu.handleTapHead(), [migu]);
  const onMiguBelly = useCallback(() => migu.handleTapBelly(), [migu]);
  const onMiguBeak = useCallback(() => migu.handleTapBeak(), [migu]);
  const onMiguWing = useCallback(() => migu.handleTapWing(), [migu]);
  const onMiguFoot = useCallback(() => migu.handleTapFoot(), [migu]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <RoomBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-4 pb-32 pt-6">
        {/* Top bar */}
        <div className="flex w-full items-center justify-between">
          <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm backdrop-blur">
            🐦 Migu - 日本語
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
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 w-full overflow-hidden"
            >
              <div className="rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("transcribe")}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      mode === "transcribe"
                        ? "bg-amber-500 text-white shadow"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🎙️ Ulangi
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("roleplay")}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      mode === "roleplay"
                        ? "bg-rose-500 text-white shadow"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    💬 Roleplay
                  </button>
                </div>

                {mode === "roleplay" && (
                  <div className="space-y-3">
                    <ScenarioPicker
                      selected={scenario}
                      onChange={(s) =>
                        setScenario({
                          ...s,
                          description: s.id === CUSTOM_SCENARIO_ID ? customScenario : s.description,
                        })
                      }
                      customText={customScenario}
                      onCustomTextChange={(t) => {
                        setCustomScenario(t);
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
                  </div>
                )}

                {!chatReady && mode === "roleplay" && (
                  <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    ⚠️ Chat service belum siap — set <code>GEMINI_API_KEY</code> di backend.
                  </div>
                )}
                {!ttsReady && (
                  <div className="mt-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    🔇 VOICEVOX belum siap — balasan tanpa audio.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

          {/* Status line under the character */}
          <div className="mt-4 flex min-h-[24px] items-center gap-2 text-sm font-medium text-slate-700">
            <AnimatePresence mode="wait">
              <motion.span
                key={status}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="rounded-full bg-white/70 px-3 py-1 backdrop-blur"
              >
                {status === "idle" && "Sentuh mic untuk bicara 👇"}
                {status === "recording" && "🎙️ Mendengarkan..."}
                {status === "uploading" && "📤 Mengirim..."}
                {status === "transcribing" && "🧠 Menerjemahkan..."}
                {status === "chatting" && "💭 Migu berpikir..."}
                {status === "speaking" && "🗣️ Migu bicara..."}
                {status === "complete" && "✅ Selesai!"}
                {status === "error" && "❌ Gagal"}
              </motion.span>
            </AnimatePresence>
            {replyAudioUrl && status === "complete" && (
              <button
                type="button"
                onClick={() => playBlob(replyAudioUrl)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow transition hover:bg-amber-600"
                aria-label="Replay"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 w-full max-w-sm rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Result text (last transcription) */}
          {resultText && status === "complete" && (
            <div className="mt-4 w-full max-w-sm rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-slate-800 shadow-sm backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Kamu bilang
              </div>
              <div className="mt-1 leading-relaxed">{resultText}</div>
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
              <ChevronUp className={`h-3 w-3 transition ${historyOpen ? "" : "rotate-180"}`} />
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

      {/* History drawer */}
      <AnimatePresence>
        {historyOpen && mode === "roleplay" && history.length > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
            <h2 className="mb-3 text-center text-lg font-bold text-slate-800">Riwayat Percakapan</h2>
            <div className="space-y-2">
              {history.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto max-w-[80%] bg-amber-100 text-slate-800"
                      : "mr-auto max-w-[80%] bg-rose-100 text-slate-800"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {m.role === "user" ? "Kamu" : "Migu"}
                  </div>
                  <div className="mt-0.5">{m.text}</div>
                  {m.translation && (
                    <div className="mt-1 text-xs italic text-slate-600">{m.translation}</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
