"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AppMode, ChatScenario, JP_LEVEL_LABELS, JP_LEVELS, JpLevel, Speaker } from "@/types/audio";
import ScenarioPicker from "./ScenarioPicker";
import SpeakerPicker from "./SpeakerPicker";

interface Props {
  open: boolean;
  mode: AppMode;
  scenario: ChatScenario;
  customScenario: string;
  speakers: Speaker[];
  selectedSpeaker: Speaker;
  ttsSpeed: number;
  jpLevel: JpLevel;
  maxTurns: number;
  chatReady: boolean;
  ttsReady: boolean;
  onModeChange: (mode: AppMode) => void;
  onScenarioChange: (s: ChatScenario) => void;
  onCustomScenarioChange: (t: string) => void;
  onSpeakerChange: (s: Speaker) => void;
  onTtsSpeedChange: (v: number) => void;
  onJpLevelChange: (v: JpLevel) => void;
  onMaxTurnsChange: (v: number) => void;
}

export default function SettingsDrawer({
  open,
  mode,
  scenario,
  customScenario,
  speakers,
  selectedSpeaker,
  ttsSpeed,
  jpLevel,
  maxTurns,
  chatReady,
  ttsReady,
  onModeChange,
  onScenarioChange,
  onCustomScenarioChange,
  onSpeakerChange,
  onTtsSpeedChange,
  onJpLevelChange,
  onMaxTurnsChange,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-3 w-full overflow-hidden"
        >
          <div className="rounded-2xl border-amber-200 bg-white/90 p-4 shadow-lg backdrop-blur">
            <div className="mb-3 inline-flex rounded-full border-slate-200 bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => onModeChange("transcribe")}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  mode === "transcribe"
                    ? "bg-amber-500 text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🎙️ Ulangi
              </button>
              <button
                type="button"
                onClick={() => onModeChange("roleplay")}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  mode === "roleplay"
                    ? "bg-rose-500 text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                💬 Roleplay
              </button>
            </div>

            {mode === "roleplay" && (
              <div className="space-y-3">
                <ScenarioPicker
                  selected={scenario}
                  onChange={onScenarioChange}
                  customText={customScenario}
                  onCustomTextChange={onCustomScenarioChange}
                />
                <SpeakerPicker
                  selected={selectedSpeaker}
                  onChange={onSpeakerChange}
                  available={speakers}
                />
              </div>
            )}

            {/* General settings — only in roleplay mode */}
            {mode === "roleplay" && (
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Pengaturan Umum
                </div>

                {/* Speed */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Kecepatan Suara — {ttsSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={ttsSpeed}
                    onChange={(e) => onTtsSpeedChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.5x</span>
                    <span>2.0x</span>
                  </div>
                </div>

                {/* JP Level */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Tingkat Bahasa Jepang
                  </label>
                  <div className="flex gap-1">
                    {JP_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onJpLevelChange(lvl)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                          jpLevel === lvl
                            ? "border-amber-500 bg-amber-500 text-white shadow"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {JP_LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Turns */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Batas Percakapan — {maxTurns} turn
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={50}
                    step={1}
                    value={maxTurns}
                    onChange={(e) => onMaxTurnsChange(parseInt(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>2</span>
                    <span>50</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    AI akan mengakhiri percakapan secara natural saat mendekati batas.
                  </p>
                </div>
              </div>
            )}

            {!chatReady && mode === "roleplay" && (
              <div className="mt-3 rounded-lg border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ Chat service belum siap — set <code>OPENAI_BASE_URL</code> / API key di backend.
              </div>
            )}
            {!ttsReady && (
              <div className="mt-3 rounded-lg border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                🔇 VOICEVOX belum siap — balasan tanpa audio.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
