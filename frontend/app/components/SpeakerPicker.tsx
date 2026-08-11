"use client";

import { Speaker, DEFAULT_SPEAKERS } from "@/types/audio";

interface Props {
  selected: Speaker;
  onChange: (s: Speaker) => void;
  available: Speaker[];
  disabled?: boolean;
}

export default function SpeakerPicker({ selected, onChange, available, disabled }: Props) {
  const list = available.length > 0 ? available : DEFAULT_SPEAKERS;

  return (
    <div className="mb-4 w-full">
      <label className="mb-1 block text-xs font-medium text-slate-500">
        Suara AI
      </label>
      <select
        value={selected.id}
        onChange={(e) => {
          const id = Number(e.target.value);
          const found = list.find((s) => s.id === id);
          if (found) onChange(found);
        }}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow appearance-none"
        style={{
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          backgroundSize: "18px",
          cursor: "pointer",
        }}
      >
        {list.map((s) => (
          <option key={s.id} value={s.id} style={{ fontSize: "14px", padding: "6px 8px" }}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
