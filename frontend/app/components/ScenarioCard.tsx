"use client";

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import Avatar from "./Avatar";
import { ChatScenario, CUSTOM_SCENARIO_ID } from "@/types/audio";

interface Props {
  scenario: ChatScenario;
  selected: boolean;
  onSelect: () => void;
  customValue?: string;
  onCustomChange?: (v: string) => void;
}

export default function ScenarioCard({ scenario, selected, onSelect, customValue, onCustomChange }: Props) {
  const isCustom = scenario.id === CUSTOM_SCENARIO_ID;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group flex w-full flex-col items-center gap-2 rounded-2xl border bg-white p-4 text-center shadow-card transition-shadow ${
        selected ? "border-blue-500 shadow-glow" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {isCustom ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <Pencil className="h-8 w-8 text-slate-500" />
        </div>
      ) : (
        <Avatar scenarioId={scenario.id} state="idle" size="sm" />
      )}
      <div className="text-sm font-semibold text-slate-900">{scenario.label}</div>
      <div className="text-xs text-slate-500 line-clamp-2">{scenario.description}</div>
      {isCustom && onCustomChange && (
        <input
          type="text"
          value={customValue ?? ""}
          onChange={(e) => onCustomChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Describe the scenario..."
          className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
        />
      )}
    </motion.button>
  );
}
