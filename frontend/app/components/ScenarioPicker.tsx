/** Scenario selector: pick a preset or switch to a custom scenario. */

"use client";

import { ChatScenario, CUSTOM_SCENARIO_ID, PRESET_SCENARIOS } from "@/types/audio";

interface ScenarioPickerProps {
  /** Currently selected scenario object (may be custom). */
  selected: ChatScenario;
  /** Callback when a preset or "custom" is picked. */
  onChange: (scenario: ChatScenario) => void;
  /** Text inside the custom-scenario input (parent owns the state). */
  customText: string;
  /** Callback when custom-scenario text changes. */
  onCustomTextChange: (text: string) => void;
}

export default function ScenarioPicker({
  selected,
  onChange,
  customText,
  onCustomTextChange,
}: ScenarioPickerProps) {
  const handleSelect = (id: string) => {
    const preset = PRESET_SCENARIOS.find((s) => s.id === id);
    if (preset) {
      onChange(preset);
      return;
    }
    if (id === CUSTOM_SCENARIO_ID) {
      onChange({
        id: CUSTOM_SCENARIO_ID,
        label: "Skenario Kustom ✏️",
        description: customText, // will be updated via onCustomTextChange below
      });
    }
  };

  const isCustom = selected.id === CUSTOM_SCENARIO_ID;

  return (
    <div className="mb-6 w-full max-w-md">
      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]/70">
        Pilih Skenario / Choose Scenario
      </label>
      <select
        value={selected.id}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--accent-blue)]/50 focus:border-[var(--accent-blue)]"
      >
        {PRESET_SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
        <option key={CUSTOM_SCENARIO_ID} value={CUSTOM_SCENARIO_ID}>
          Skenario Kustom… (Custom)
        </option>
      </select>
      {isCustom && (
        <div className="mt-3">
          <input
            type="text"
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="例: あなたは京都で観光客を案内するツアーガイドです"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder-[var(--text-secondary)]/40 hover:border-[var(--accent-blue)]/50 focus:border-[var(--accent-blue)]"
          />
        </div>
      )}
    </div>
  );
}
