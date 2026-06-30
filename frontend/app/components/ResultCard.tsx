/** Display transcription result with text, duration, and language. */

"use client";

interface ResultCardProps {
  text: string;
  duration: number;
  language: string;
  isError: boolean;
}

export default function ResultCard({
  text,
  duration,
  language,
  isError,
}: ResultCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 backdrop-blur-sm ${
        isError
          ? "border-red-500/30 bg-red-500/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
      }`}
    >
      {/* Result header */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${
            isError ? "bg-red-500" : "bg-green-500"
          }`}
        />
        <span
          className={`text-xs font-medium ${
            isError ? "text-red-400" : "text-green-400"
          }`}
        >
          {isError ? "Error" : "Transcription Complete"}
        </span>

        {!isError && language && (
          <span className="ml-auto text-xs text-[var(--text-secondary)]/50">
            {language.toUpperCase()}
          </span>
        )}
      </div>

      {/* Transcribed text */}
      <div
        className={`rounded-lg p-3 text-base leading-relaxed ${
          isError
            ? "text-red-300/80"
            : "text-[var(--text-primary)]"
        }`}
      >
        {isError
          ? text
          : text
        }
      </div>

      {/* Duration */}
      {!isError && duration > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]/50">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Duration: {duration.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
