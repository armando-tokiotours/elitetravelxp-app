"use client";

import { TOUR_PACKAGES, CITIES } from "@/config/pricing-data";
import { useItineraryStore } from "@/store/useItineraryStore";
import { calculateQuotation, formatUsd } from "@/lib/pricing-engine";
import { ModuleShell, OptionChip, ToggleYesNo } from "./ModuleShell";

export function ExcursionsTours() {
  const cityNights = useItineraryStore((s) => s.cityNights);
  const selectedTours = useItineraryStore((s) => s.selectedTours);
  const privateChauffeur = useItineraryStore((s) => s.privateChauffeur);
  const toggleTour = useItineraryStore((s) => s.toggleTour);
  const setPrivateChauffeur = useItineraryStore((s) => s.setPrivateChauffeur);
  const state = useItineraryStore();

  const quotation = calculateQuotation(state);
  const selectedCityIds = new Set(cityNights.map((c) => c.cityId));
  const availableTours = TOUR_PACKAGES.filter((t) =>
    selectedCityIds.has(t.cityId)
  );

  return (
    <ModuleShell
      step={8}
      title="Excursions & Guided Tours"
      description="Private guided experiences by city. Tours are not scheduled on inter-city travel days."
    >
      <div className="mb-5 border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
        Approximately{" "}
        <span className="text-[#D4AF37]">{quotation.tourableDays}</span>{" "}
        tourable day{quotation.tourableDays === 1 ? "" : "s"} after excluding{" "}
        {quotation.interCityLegs} inter-city travel day
        {quotation.interCityLegs === 1 ? "" : "s"}.
      </div>

      {availableTours.length === 0 ? (
        <p className="text-sm text-white/45">
          Select cities in Module 7 to unlock location-specific tours.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(selectedCityIds).map((cityId) => {
            const city = CITIES.find((c) => c.id === cityId);
            const tours = availableTours.filter((t) => t.cityId === cityId);
            if (tours.length === 0) return null;
            return (
              <div key={cityId}>
                <p className="mb-3 font-display text-lg text-white">
                  {city?.label}
                </p>
                <div className="grid gap-2">
                  {tours.map((tour) => {
                    const selected = selectedTours.includes(tour.id);
                    return (
                      <OptionChip
                        key={tour.id}
                        selected={selected}
                        onClick={() => toggleTour(tour.id)}
                        className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>{tour.name}</span>
                        <span className="text-xs opacity-70">
                          {tour.durationHours}h · {formatUsd(tour.priceMin)}–
                          {formatUsd(tour.priceMax)}
                        </span>
                      </OptionChip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 border-t border-white/10 pt-6">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
          Private Chauffeur / Driver
        </p>
        <ToggleYesNo
          value={privateChauffeur}
          onChange={setPrivateChauffeur}
        />
      </div>
    </ModuleShell>
  );
}
