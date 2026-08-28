"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, ArrowLeft, BookOpen, Volume2 } from "lucide-react";
import { ChatMessage, JpLevel, JP_LEVELS, JP_LEVEL_LABELS, KaiwaScenario, TranscriptionStatus } from "@/types/audio";
import { chatClient, kaiwaClient, SessionTurn, ttsClient } from "@/services/api";
import { useMicrophone } from "@/hooks/useMicrophone";
import ChatHistory from "@/components/ChatHistory";
import Sidebar from "@/components/Sidebar";
import { useSessionContext } from "@/components/SessionProvider";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type KaiwaStatus = "idle" | "recording" | "uploading" | "transcribing" | "chatting" | "speaking" | "complete" | "error";

interface KaiwaTurn {
  question: string;
  topic_hint: string;
  question_id: string;
}

export default function KaiwaPage() {
  const { role, token } = useAuth();
  const session = useSessionContext();
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

  // Scenarios
  const [scenarios, setScenarios] = useState<KaiwaScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<KaiwaScenario | null>(null);

  // Practice state
  const [questions, setQuestions] = useState<KaiwaTurn[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [jpLevel, setJpLevel] = useState<JpLevel>("n3");
  const [maxTurns, setMaxTurns] = useState(10);
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);
  const [ttsReady, setTtsReady] = useState(false);
  const [chatReady, setChatReady] = useState(false);

  // UI state
  const [status, setStatus] = useState<KaiwaStatus>("idle");
  const [transcribedText, setTranscribedText] = useState("");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load scenarios
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    kaiwaClient
      .fetchScenarios(API_BASE, token, "kaiwa")
      .then((list) => {
        if (cancelled) return;
        setScenarios(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingScenarios(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  // Health
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const r = await fetch(`${API_BASE}/health`).catch(() => null);
        if (!r) return;
        const h = await r.json();
        if (cancelled) return;
        setChatReady(h.chat_ready ?? false);
        setTtsReady(h.tts_ready ?? false);
      } catch {
        if (!cancelled) { setChatReady(false); setTtsReady(false); }
      }
    };
    void probe();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void probe();
    }, 10_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const playBlob = useCallback((url: string) => {
    new Audio(url).play().catch(() => {});
  }, []);

  const resetPractice = useCallback(() => {
    setHistory([]);
    setCurrentQuestionIdx(0);
    setTranscribedText("");
    setError("");
    setStatus("idle");
    setReplyAudioUrl(null);
    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
      lastBlobUrlRef.current = null;
    }
  }, []);

  const selectScenario = useCallback((s: KaiwaScenario) => {
    setSelectedScenario(s);
    const qs = (s.kind_config?.questions || []).map((q): KaiwaTurn => ({
      question: q.question,
      topic_hint: q.topic_hint,
      question_id: q.id,
    }));
    setQuestions(qs);
    setCurrentQuestionIdx(0);
    resetPractice();
  }, [resetPractice]);

  // Auto-play first question on scenario select
  useEffect(() => {
    if (questions.length === 0) return;
    const q = questions[currentQuestionIdx];
    if (!q) return;
    // Ask AI to introduce the first question via chat
    askAI(q.question, q.topic_hint, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario?.scenario_id]);

  const askAI = useCallback(async (userText: string, topicHint: string, currentHistory: ChatMessage[]) => {
    if (!selectedScenario) return;
    const q = questions[currentQuestionIdx];
    if (!q) return;

    setStatus("chatting");
    let chatRes;
    try {
      chatRes = await kaiwaClient.send(
        {
          user_text: userText,
          scenario_id: selectedScenario.scenario_id,
          question_id: q.question_id,
          history: currentHistory,
          jp_level: jpLevel,
          max_turns: maxTurns,
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
    if (ttsReady && chatRes.reply_jp) {
      setStatus("speaking");
      try {
        const audioBlob = await ttsClient.synthesise(
          { text: chatRes.reply_jp, speed: 1.0 },
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
  }, [selectedScenario, questions, currentQuestionIdx, jpLevel, maxTurns, ttsReady, playBlob]);

  const handleMicStart = useCallback(async () => {
    setError("");
    setStatus("recording");
    try {
      await startRecording();
    } catch {
      setStatus("error");
    }
  }, [startRecording]);

  const handleMicStop = useCallback(async () => {
    let blob: Blob | null = null;
    try {
      blob = await stopRecording();
    } catch {
      setStatus("error");
      return;
    }
    if (!blob || blob.size === 0) {
      setError("Recording empty. Try again.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    let uploadResult;
    try {
      const r = await fetch(`${API_BASE}/transcribe`, {
        method: "POST",
        body: blob,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      uploadResult = await r.json();
    } catch {
      setError("Transcription failed");
      setStatus("error");
      return;
    }

    if (!uploadResult.success || !uploadResult.text?.trim()) {
      setError("Tidak ada teks terdeteksi. Coba lagi.");
      setStatus("error");
      return;
    }

    setTranscribedText(uploadResult.text);
    setStatus("chatting");

    if (!chatReady) {
      setError("Chat service not ready");
      setStatus("error");
      return;
    }

    const q = questions[currentQuestionIdx];
    if (!q) {
      setError("No question loaded");
      setStatus("error");
      return;
    }

    const turn: SessionTurn = {
      turn: history.length + 1,
      ts: Math.floor(Date.now() / 1000),
      user_text: uploadResult.text,
      language: uploadResult.language ?? "ja",
      audio_duration_ms: Math.round((uploadResult.duration ?? 0) * 1000),
      ai_reply_jp: null,
      ai_reply_translation: null,
      tts_speaker_id: null,
      audio_blob_ref: null,
      scenario_switched: false,
      error: null,
    };
    void session.appendTurn(turn);

    await askAI(uploadResult.text, q.topic_hint, history);
  }, [stopRecording, chatReady, questions, currentQuestionIdx, history, askAI, session]);

  const replayTTS = useCallback(() => {
    if (replyAudioUrl) playBlob(replyAudioUrl);
  }, [replyAudioUrl, playBlob]);

  // Skip to next question
  const nextQuestion = useCallback(() => {
    if (questions.length <= currentQuestionIdx + 1) return;
    const nextIdx = currentQuestionIdx + 1;
    setCurrentQuestionIdx(nextIdx);
    resetPractice();
    const q = questions[nextIdx];
    if (q) askAI(q.question, q.topic_hint, []);
  }, [questions, currentQuestionIdx, resetPractice, askAI]);

  const denied = hasPermission === false;

  if (!selectedScenario) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          isAdmin={role === "admin"}
        />
        <div className={`relative z-10 transition-all duration-300 ${sidebarOpen ? "pl-[52px]" : "pl-0"}`}>
          <div className="mx-auto w-full max-w-2xl px-4 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <a href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition">
                <ArrowLeft className="h-4 w-4" />
              </a>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Kaiwa Renshuu</h1>
                <p className="text-xs text-slate-500">Latihan percakapan Jepang dengan guru AI</p>
              </div>
            </div>

            {loadingScenarios ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
              </div>
            ) : scenarios.length === 0 ? (
              <div className="rounded-2xl bg-white/80 border border-slate-200 p-8 text-center text-sm text-slate-500 backdrop-blur">
                Belum ada skenario Kaiwa. Hubungi admin untuk menambahkan.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scenarios.map((s) => (
                  <button
                    key={s.scenario_id}
                    type="button"
                    onClick={() => selectScenario(s)}
                    className="rounded-2xl bg-white/80 border border-slate-200 p-4 text-left shadow-sm backdrop-blur transition hover:border-amber-300 hover:shadow-md"
                  >
                    <div className="text-2xl mb-2">{s.emoji || "💬"}</div>
                    <div className="font-semibold text-slate-800">{s.label}</div>
                    <div className="mt-1 text-xs text-slate-500 line-clamp-2">{s.description}</div>
                    <div className="mt-2 text-[11px] font-medium text-amber-600">
                      {s.kind_config?.questions?.length || 0} pertanyaan
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIdx];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        isAdmin={role === "admin"}
      />
      <div className={`relative z-10 transition-all duration-300 ${sidebarOpen ? "pl-[52px]" : "pl-0"}`}>
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setSelectedScenario(null); resetPractice(); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedScenario.emoji}</span>
              <div>
                <h1 className="text-lg font-bold text-slate-800">{selectedScenario.label}</h1>
                <p className="text-[10px] text-slate-500">
                  Pertanyaan {currentQuestionIdx + 1} / {questions.length}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={jpLevel}
                onChange={(e) => setJpLevel(e.target.value as JpLevel)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white/80 text-slate-600 backdrop-blur"
              >
                {JP_LEVELS.map((l) => (
                  <option key={l} value={l}>{JP_LEVEL_LABELS[l]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={nextQuestion}
                disabled={currentQuestionIdx >= questions.length - 1}
                className="flex items-center gap-1 rounded-lg bg-white/80 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur disabled:opacity-40 hover:bg-white transition"
              >
                Selanjutnya
                <BookOpen className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-auto mt-3 w-full max-w-sm rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Question card */}
        {currentQ && (
          <div className="mx-auto mt-4 w-full max-w-sm rounded-2xl bg-white/80 border border-amber-200 p-4 backdrop-blur shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">Latihan Mendan</div>
            <div className="text-sm text-slate-700 leading-relaxed">{currentQ.question}</div>
            {currentQ.topic_hint && (
              <div className="mt-2 text-[11px] text-slate-400 italic">{currentQ.topic_hint}</div>
            )}
          </div>
        )}

        {/* Chat history */}
        <div className="mx-auto mt-4 w-full max-w-sm">
          <ChatHistory
            messages={history}
            lastTranslation={history.filter(m => m.role === "model").at(-1)?.translation ?? null}
            audioForLastReply={replyAudioUrl}
          />
        </div>

        {/* Mic button */}
        <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pb-4 sm:pb-6">
          <div className="flex items-center gap-3">
            {replyAudioUrl && status === "complete" && (
              <button
                type="button"
                onClick={replayTTS}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 shadow transition hover:bg-slate-50"
                aria-label="Replay TTS"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              disabled={denied || status === "uploading" || status === "transcribing" || status === "chatting"}
              onClick={isRecording ? handleMicStop : handleMicStart}
              className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all focus:outline-none focus:ring-4 ${
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
                <MicOff className="h-6 w-6" />
              ) : isRecording ? (
                <span className="block h-4 w-4 rounded-sm bg-white" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {(permissionError || !mediaDevicesSupported) && (
          <div className="mx-auto w-full max-w-sm animate-pulse rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-red-700">Mikrofon tidak bisa digunakan</p>
            <p className="mt-1 text-xs text-red-600">
              {permissionError ?? "Pastikan mengakses halaman ini via HTTPS atau localhost."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
