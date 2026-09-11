"use client";

import { CITIES, type CityId } from "@/config/pricing-data";
import {
  useItineraryStore,
  totalAssignedNights,
} from "@/store/useItineraryStore";
import { Counter, ModuleShell, OptionChip } from "./ModuleShell";

export function LocationNightAllocation() {
  const durationDays = useItineraryStore((s) => s.durationDays);
  const cityNights = useItineraryStore((s) => s.cityNights);
  const toggleCity = useItineraryStore((s) => s.toggleCity);
  const setCityNights = useItineraryStore((s) => s.setCityNights);

  const nightsRequired = durationDays;
  const nightsAssigned = totalAssignedNights(cityNights);
  const isValid = nightsAssigned === nightsRequired;
  const selectedIds = new Set(cityNights.map((c) => c.cityId));

  return (
    <ModuleShell
      step={7}
      title="Location & Night Allocation"
      description="Select cities and assign nights. Total nights must match the trip duration selected above."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {CITIES.map((city) => (
          <OptionChip
            key={city.id}
            selected={selectedIds.has(city.id)}
            onClick={() => toggleCity(city.id as CityId)}
          >
            {city.label}
          </OptionChip>
        ))}
      </div>

      {cityNights.length > 0 ? (
        <div className="space-y-3">
          {cityNights.map((cn) => {
            const city = CITIES.find((c) => c.id === cn.cityId);
            return (
              <div
                key={cn.cityId}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="font-display text-lg text-white">
                    {city?.label}
                  </p>
                  <p className="text-xs text-white/40">{city?.region}</p>
                </div>
                <Counter
                  label="Nights"
                  value={cn.nights}
                  min={1}
                  max={30}
                  onChange={(n) => setCityNights(cn.cityId, n)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-white/45">Select at least one city.</p>
      )}

      <div
        className={`mt-5 border px-4 py-3 text-sm ${
          isValid
            ? "border-[#D4AF37]/35 bg-[#D4AF37]/8 text-[#D4AF37]"
            : "border-red-400/40 bg-red-500/10 text-red-300"
        }`}
      >
        {isValid
          ? `Night allocation valid — ${nightsAssigned} of ${nightsRequired} nights assigned.`
          : `Night mismatch — ${nightsAssigned} assigned of ${nightsRequired} required for a ${durationDays}-day trip.`}
      </div>
    </ModuleShell>
  );
}
