/** Duration bar showing recording time with visual waveform. */

"use client";

interface DurationBarProps {
  duration: number;
  isActive: boolean;
}

export default function DurationBar({ duration, isActive }: DurationBarProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Waveform bars */}
      <div className="mic-wave">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="mic-wave-bar"
          />
        ))}
      </div>

      {/* Timer */}
      <span className="font-mono text-sm text-red-400">
        {formatTime(duration)}
      </span>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-1000 ${
            isActive ? "animate-pulse" : ""
          }`}
          style={{
            width: isActive ? `${Math.min((duration / 30) * 100, 100)}%` : "0%",
          }}
        />
      </div>
    </div>
  );
}
