"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Volume2 } from "lucide-react";
import { Speaker, DEFAULT_SPEAKERS } from "@/types/audio";

interface Props {
  selected: Speaker;
  onChange: (s: Speaker) => void;
  available: Speaker[];
  disabled?: boolean;
}

export default function SpeakerPicker({ selected, onChange, available, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const list = (available.length > 0 ? available : DEFAULT_SPEAKERS).filter((s) => s.id !== undefined);

  return (
    <div className="relative mb-4 w-full max-w-md">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-card disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-blue-600" />
          {selected.label}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-card"
          >
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>{s.label}</span>
                  {s.id === selected.id && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}