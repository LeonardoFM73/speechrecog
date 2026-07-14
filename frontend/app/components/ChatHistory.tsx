"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, User } from "lucide-react";
import Avatar from "./Avatar";
import { ChatMessage, PRESET_SCENARIOS } from "@/types/audio";

interface Props {
  messages: ChatMessage[];
  lastTranslation: string | null;
  audioForLastReply: string | null;
}

function scenarioTitle(id?: string): string {
  if (!id) return "AI";
  return PRESET_SCENARIOS.find((s) => s.id === id)?.label ?? "AI";
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

  if (messages.length === 0) {
    return (
      <div className="w-full max-w-md rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
        Mulai bicara dalam bahasa Jepang untuk memulai percakapan.
        <br />
        <span className="text-slate-300">(Press the mic, speak Japanese — the AI will reply in Japanese + Indonesian.)</span>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
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
                <div className="whitespace-pre-wrap">{m.text}</div>
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
