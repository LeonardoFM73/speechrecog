"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Volume2 } from "lucide-react";
import { TranscriptionStatus } from "@/types/audio";

const STATUS_LABELS: Record<TranscriptionStatus, string> = {
  idle: "Tekan untuk mulai",
  recording: "Mendengarkan...",
  uploading: "Mengirim...",
  transcribing: "Transkripsi...",
  chatting: "Berpikir...",
  speaking: "Bicara...",
  complete: "Selesai!",
  error: "Gagal",
};

interface Props {
  status: TranscriptionStatus;
  error: string;
  transcribedText: string;
  replyAudioUrl: string | null;
  mode: "transcribe" | "roleplay" | "kaiwa";
  historyOpen: boolean;
  onReplay: () => void;
  onToggleHistory: () => void;
}

export default function MicStage({
  status,
  error,
  transcribedText,
  replyAudioUrl,
  mode,
  historyOpen,
  onReplay,
  onToggleHistory,
}: Props) {
  return (
    <div className="mt-3 flex min-h-[28px] items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur"
        >
          {STATUS_LABELS[status]}
        </motion.span>
      </AnimatePresence>
      {replyAudioUrl && status === "complete" && (
        <button
          type="button"
          onClick={onReplay}
          className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow transition hover:bg-amber-600"
          aria-label="Replay"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
