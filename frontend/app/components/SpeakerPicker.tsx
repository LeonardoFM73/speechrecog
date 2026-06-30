"use client";

import { Speaker, DEFAULT_SPEAKERS } from "@/types/audio";

interface SpeakerPickerProps {
  /** Currently selected speaker. */
  selected: Speaker;
  /** Called when the user picks a different speaker. */
  onChange: (speaker: Speaker) => void;
  /** Speakers fetched from /speakers; defaults to DEFAULT_SPEAKERS when empty. */
  available: Speaker[];
  /** Disable the dropdown (e.g. while the engine is loading). */
  disabled?: boolean;
}

export default function SpeakerPicker({
  selected,
  onChange,
  available,
  disabled,
}: SpeakerPickerProps) {
  // De-duplicate by id; fall back to DEFAULT_SPEAKERS if the engine hasn't
  // returned speakers yet.
  const raw = (available.length > 0 ? available : DEFAULT_SPEAKERS).filter(
    (s) => s.id !== undefined,
  );
  const dedup = Array.from(new Map(raw.map((s) => [s.id, s])).values());

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const speaker = dedup.find((s) => s.id === id);
    if (speaker) {
      onChange(speaker);
    }
  };

  return (
    <div className="mb-4 w-full max-w-md">
      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]/70">
        🎭 Speaker / Suara Guru
      </label>
      <select
        value={selected.id}
        onChange={handleChange}
        disabled={disabled}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--accent-blue)]/50 focus:border-[var(--accent-blue)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dedup.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
