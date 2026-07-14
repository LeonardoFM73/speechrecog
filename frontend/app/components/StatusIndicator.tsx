"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Bot, Volume2, CheckCircle2, AlertCircle } from "lucide-react";
import { TranscriptionStatus } from "@/types/audio";

interface Props {
  status: TranscriptionStatus;
  label: string;
  isRecording: boolean;
}

const COLORS: Record<string, string> = {
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