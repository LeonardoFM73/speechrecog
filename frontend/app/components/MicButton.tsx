/** Record/Stop button with visual mic icon. */

"use client";

interface MicButtonProps {
  isRecording: boolean;
  hasPermission: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function MicButton({
  isRecording,
  hasPermission,
  onStart,
  onStop,
}: MicButtonProps) {
  return (
    <button
      onClick={isRecording ? onStop : onStart}
      disabled={isRecording ? false : false}
      className={`group relative flex h-20 w-20 items-center justify-center rounded-full text-2xl shadow-2xl transition-all duration-300 cursor-pointer ${
        isRecording
          ? "bg-red-500/20 shadow-red-500/30 ring-2 ring-red-500/50"
          : "bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:shadow-[0_0_50px_rgba(59,130,246,0.3)]"
      }`}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {/* Pulse ring when recording */}
      {isRecording && (
        <span className="absolute inset-0 -m-2 animate-ping rounded-full border-2 border-red-500/30" />
      )}

      {/* Mic icon */}
      <svg
        className={`h-8 w-8 transition-colors ${
          isRecording ? "text-red-400" : "text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  );
}
