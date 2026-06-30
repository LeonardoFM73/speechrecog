/** Status indicator showing current state and visual feedback. */

"use client";

import { TranscriptionStatus } from "@/types/audio";

interface StatusIndicatorProps {
  status: TranscriptionStatus;
  label: string;
  isRecording: boolean;
}

const statusColors: Record<TranscriptionStatus, string> = {
  idle: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  recording: "bg-red-500/20 text-red-400 border-red-500/30",
  uploading: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  transcribing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  chatting: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  speaking: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

const pulseDots: Record<TranscriptionStatus, string> = {
  idle: "hidden",
  recording: "block",
  uploading: "block",
  transcribing: "block",
  chatting: "block",
  speaking: "block",
  complete: "hidden",
  error: "hidden",
};

export default function StatusIndicator({
  status,
  label,
  isRecording,
}: StatusIndicatorProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {/* Pulsing dot */}
      <div
        className={`h-3 w-3 rounded-full transition-colors ${
          status === "recording"
            ? "bg-red-500 animate-pulse-ring"
            : status === "speaking"
            ? "bg-emerald-500 animate-pulse-ring"
            : status === "complete"
            ? "bg-green-500"
            : status === "error"
            ? "bg-red-500"
            : "bg-gray-500"
        }`}
      />

      {/* Status badge */}
      <span
        className={`rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors ${
          statusColors[status]
        }`}
      >
        {label}
        {["uploading", "transcribing", "recording", "chatting", "speaking"].includes(status) && (
          <span className="ml-2 inline-flex gap-0.5">
            <span className="h-1 w-1 animate-[bounce_1s_infinite] rounded-full bg-current" />
            <span className="h-1 w-1 animate-[bounce_1s_infinite_0.2s] rounded-full bg-current" />
            <span className="h-1 w-1 animate-[bounce_1s_infinite_0.4s] rounded-full bg-current" />
          </span>
        )}
      </span>
    </div>
  );
}
