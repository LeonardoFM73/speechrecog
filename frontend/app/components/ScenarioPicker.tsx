"use client";

import { LayoutGroup } from "framer-motion";
import ScenarioCard from "./ScenarioCard";
import { ChatScenario, CUSTOM_SCENARIO_ID, PRESET_SCENARIOS } from "@/types/audio";

interface ScenarioPickerProps {
  selected: ChatScenario;
  onChange: (s: ChatScenario) => void;
  customText: string;
  onCustomTextChange: (t: string) => void;
}

export default function ScenarioPicker({ selected, onChange, customText, onCustomTextChange }: ScenarioPickerProps) {
  return (
    <div className="mb-6 w-full max-w-2xl">
      <div className="mb-3 text-center text-sm font-medium text-slate-700">Pilih Skenario / Choose Scenario</div>
      <LayoutGroup>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PRESET_SCENARIOS.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              selected={selected.id === s.id}
              onSelect={() => onChange({ ...s, description: s.id === CUSTOM_SCENARIO_ID ? customText : s.description })}
            />
          ))}
          <ScenarioCard
            scenario={{ id: CUSTOM_SCENARIO_ID, label: "Kustom", description: customText || "Buat skenario sendiri" }}
            selected={selected.id === CUSTOM_SCENARIO_ID}
            onSelect={() => onChange({ ...selected, id: CUSTOM_SCENARIO_ID, description: customText })}
            customValue={customText}
            onCustomChange={(t) => onCustomTextChange(t)}
          />
        </div>
      </LayoutGroup>
    </div>
  );
}
