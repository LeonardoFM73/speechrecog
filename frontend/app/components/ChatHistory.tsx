/** Scrollable chat history: alternating user (right, blue) / model (left, purple) bubbles. */

"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/types/audio";
import AudioPlayer from "@/components/AudioPlayer";

interface ChatHistoryProps {
  messages: ChatMessage[];
  /** Last model reply's Indonesian translation (shown directly under last model bubble). */
  lastTranslation: string | null;
  /**
   * Blob URL of the synthesised audio for the LAST model reply.
   * null = no audio (e.g. transcribe mode, TTS disabled, or reply in progress).
   */
  audioForLastReply: string | null;
  /** Notifies the parent when audio playback state changes. */
  onAudioPlayStateChange?: (playing: boolean) => void;
}

export default function ChatHistory({
  messages,
  lastTranslation,
  audioForLastReply,
  onAudioPlayStateChange,
}: ChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="w-full max-w-md rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/50 px-4 py-6 text-center text-xs text-[var(--text-secondary)]/60">
        Mulai bicara dalam bahasa Jepang untuk memulai percakapan.
        <br />
        <span className="text-[var(--text-secondary)]/40">
          (Press the mic, speak Japanese — the AI will reply in Japanese + Indonesian.)
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="w-full max-w-md space-y-3 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-4"
      style={{ maxHeight: "320px" }}
    >
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isLastModel = !isUser && i === messages.length - 1;
        return (
          <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-md ${
                isUser
                  ? "rounded-br-sm bg-[var(--accent-blue)]/20 text-[var(--text-primary)] ring-1 ring-[var(--accent-blue)]/30"
                  : "rounded-bl-sm bg-[var(--accent-purple)]/20 text-[var(--text-primary)] ring-1 ring-[var(--accent-purple)]/30"
              }`}
            >
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]/60">
                {isUser ? "Kamu" : "AI (日本語)"}
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
              {isLastModel && audioForLastReply && (
                <AudioPlayer
                  src={audioForLastReply}
                  autoPlay={true}
                  onPlay={() => onAudioPlayStateChange?.(true)}
                  onPause={() => onAudioPlayStateChange?.(false)}
                  onEnded={() => onAudioPlayStateChange?.(false)}
                />
              )}
              {isLastModel && lastTranslation && (
                <div className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-xs italic text-[var(--text-secondary)]/80">
                  🇮🇩 {lastTranslation}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
