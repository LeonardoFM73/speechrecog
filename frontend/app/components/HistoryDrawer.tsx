"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ChatMessage } from "@/types/audio";

interface Props {
  open: boolean;
  history: ChatMessage[];
  onClose: () => void;
}

export default function HistoryDrawer({ open, history, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative mx-auto mt-16 flex h-[80vh] max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-lg font-bold text-slate-800">Riwayat Percakapan</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300" />

            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-8">
              {history.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    m.role === "user"
                      ? "ml-auto max-w-[80%] bg-amber-100 text-slate-800"
                      : "mr-auto max-w-[80%] bg-rose-100 text-slate-800"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {m.role === "user" ? "Kamu" : "Migu"}
                  </div>
                  <div className="mt-0.5">{m.text}</div>
                  {m.translation && (
                    <div className="mt-1 text-xs italic text-slate-600">{m.translation}</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
