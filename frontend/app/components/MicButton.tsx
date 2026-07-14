"use client";

import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";

interface Props {
  isRecording: boolean;
  hasPermission: boolean | null;
  onStart: () => void;
  onStop: () => void;
  level?: number;
}

export default function MicButton({ isRecording, hasPermission, onStart, onStop, level = 0 }: Props) {
  const denied = hasPermission === false;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {[0, 0.5, 1].map((delay) =>
          isRecording ? (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full border-2 border-red-500"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.3, 1.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay }}
            />
          ) : null,
        )}
        <motion.button
          type="button"
          onClick={isRecording ? onStop : onStart}
          disabled={denied}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: denied ? 1 : 1.05 }}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl focus:outline-none focus:ring-4 transition-all ${
            denied
              ? "bg-red-900/60 cursor-not-allowed ring-2 ring-red-500/30"
              : isRecording
                ? "bg-red-600 focus:ring-red-400 shadow-red-500/50"
                : "bg-blue-600 focus:ring-blue-400 shadow-blue-500/50 hover:bg-blue-500"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {denied ? <MicOff className="h-8 w-8" /> : isRecording ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
        </motion.button>
      </div>
      {hasPermission === null && (
        <p className="text-xs text-gray-400 text-center max-w-[180px]">
          Klik mic untuk mulai. Izinkan akses mikrofon di browser.
        </p>
      )}
      {denied && (
        <p className="text-xs text-red-400 text-center max-w-[240px]">
          Akses mikrofon ditolak. Buka Settings browser → Site Settings → Microphone → Allow.
        </p>
      )}
      {isRecording && (
        <div className="mic-wave" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="mic-wave-bar"
              style={{
                transform: `scaleY(${0.4 + Math.min(1, level * 4) * (0.6 + Math.sin((Date.now() / 200) + i) * 0.4)})`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
