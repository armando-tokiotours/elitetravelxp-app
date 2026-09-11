"use client";

import { TRANSIT_MODES, type TransitMode } from "@/config/pricing-data";
import { useItineraryStore } from "@/store/useItineraryStore";
import { ModuleShell, OptionChip } from "./ModuleShell";

export function InterCityTransit() {
  const transitMode = useItineraryStore((s) => s.transitMode);
  const setTransitMode = useItineraryStore((s) => s.setTransitMode);

  return (
    <ModuleShell
      step={9}
      title="Inter-City Transit Mode"
      description="Primary mode of travel between your selected destinations."
    >
      <div className="grid gap-3">
        {TRANSIT_MODES.map((mode) => (
          <OptionChip
            key={mode.id}
            selected={transitMode === mode.id}
            onClick={() => setTransitMode(mode.id as TransitMode)}
            className="w-full"
          >
            <span className="block font-medium">{mode.label}</span>
            <span className="mt-1 block text-xs opacity-65">
              {mode.description}
            </span>
          </OptionChip>
        ))}
      </div>
    </ModuleShell>
  );
}
