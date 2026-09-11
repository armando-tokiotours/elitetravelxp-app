"use client";

import { DURATION_OPTIONS } from "@/config/pricing-data";
import { useItineraryStore } from "@/store/useItineraryStore";
import { ModuleShell, OptionChip } from "./ModuleShell";

export function TripDuration() {
  const durationDays = useItineraryStore((s) => s.durationDays);
  const isCustomDuration = useItineraryStore((s) => s.isCustomDuration);
  const setDurationDays = useItineraryStore((s) => s.setDurationDays);
  const setCustomDuration = useItineraryStore((s) => s.setCustomDuration);

  return (
    <ModuleShell
      step={1}
      title="Trip Duration"
      description="Choose a curated length or set a custom itinerary duration."
    >
      <div className="flex flex-wrap gap-3">
        {DURATION_OPTIONS.map((days) => (
          <OptionChip
            key={days}
            selected={!isCustomDuration && durationDays === days}
            onClick={() => {
              setCustomDuration(false, days);
              setDurationDays(days);
            }}
          >
            {days} Days
          </OptionChip>
        ))}
        <OptionChip
          selected={isCustomDuration}
          onClick={() => setCustomDuration(true)}
        >
          Custom
        </OptionChip>
      </div>

      {isCustomDuration ? (
        <div className="mt-5 flex items-center gap-3">
          <label htmlFor="custom-days" className="text-sm text-white/55">
            Number of days
          </label>
          <input
            id="custom-days"
            type="number"
            min={3}
            max={60}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value) || 1)}
            className="w-24 border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
          />
        </div>
      ) : null}
    </ModuleShell>
  );
}
