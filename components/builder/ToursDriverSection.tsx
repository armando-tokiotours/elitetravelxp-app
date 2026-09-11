"use client";

import { useMemo, useState } from "react";
import type { PbTour } from "@/lib/pocketbase/client";
import { tourPrice } from "@/lib/pocketbase/client";
import { formatUsd } from "@/lib/builder-pricing";
import {
  matchSeasonalHighlights,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BuilderPortalSheet } from "./BuilderPortalSheet";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import { FieldLabel, PillToggle, SectionBlock } from "./ui";

export function ToursDriverSection({
  tours,
  cityNames,
  allowToursOnTravelDays = false,
  seasonalHighlights = [],
}: {
  tours: PbTour[];
  cityNames: Record<string, string>;
  allowToursOnTravelDays?: boolean;
  seasonalHighlights?: SeasonalHighlight[];
}) {
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const needDriver = useBuilderStore((s) => s.needDriver);
  const toggleTour = useBuilderStore((s) => s.toggleTour);
  const setNeedDriver = useBuilderStore((s) => s.setNeedDriver);
  const durationDays = useBuilderStore((s) => s.durationDays);

  const [open, setOpen] = useState(false);

  const selectedCityIds = useMemo(
    () => new Set(locations.map((l) => l.cityId)),
    [locations]
  );

  const availableTours = useMemo(
    () => tours.filter((t) => selectedCityIds.has(t.city_id)),
    [tours, selectedCityIds]
  );

  const travelDays = Math.max(0, locations.length - 1);
  const tourableDays = allowToursOnTravelDays
    ? durationDays
    : Math.max(0, durationDays - travelDays);

  const seasonalMatches = useMemo(
    () =>
      matchSeasonalHighlights(
        seasonalHighlights,
        arrivalDate,
        locations.map((l) => ({ cityId: l.cityId, nights: l.nights }))
      ),
    [seasonalHighlights, arrivalDate, locations]
  );

  const tourCount = selectedTourIds.length;
  const summary = `${
    tourCount === 0
      ? "No tours"
      : `${tourCount} tour${tourCount === 1 ? "" : "s"} selected`
  } · Chauffeur: ${needDriver ? "Yes" : "No"}`;

  return (
    <SectionBlock
      number={5}
      title="Tours & Driver"
      id="section-tours"
      icon="tour"
      summary={summary}
    >
      <div className="mb-5 rounded-xl bg-[#F7F3EC] px-4 py-3 text-sm text-[#5C6570]">
        {allowToursOnTravelDays
          ? `Tours allowed on travel days · ~${tourableDays} day${tourableDays === 1 ? "" : "s"} available.`
          : `Tours (no tours on travel days) · ~${tourableDays} available day${tourableDays === 1 ? "" : "s"} after ${travelDays} travel day${travelDays === 1 ? "" : "s"}.`}
      </div>

      {seasonalMatches.length > 0 ? (
        <div className="mb-5 space-y-2">
          <FieldLabel>Concierge suggestions</FieldLabel>
          {seasonalMatches.map((m) => (
            <ConciergeSuggestionCard
              key={`${m.highlight.id}-${m.cityId}-tours`}
              match={m}
              tourAlreadyAdded={
                !!m.highlight.suggested_tour_id &&
                selectedTourIds.includes(m.highlight.suggested_tour_id)
              }
              onAddTour={(id) => {
                if (!selectedTourIds.includes(id)) toggleTour(id);
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mb-6">
        <FieldLabel>Tours</FieldLabel>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-full border border-[#0B1F3A] bg-white py-3 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#0B1F3A] hover:text-white"
        >
          See Tours
          {selectedTourIds.length > 0
            ? ` (${selectedTourIds.length} selected)`
            : ""}
        </button>
      </div>

      <div>
        <FieldLabel>Driver</FieldLabel>
        <PillToggle value={needDriver} onChange={setNeedDriver} />
      </div>

      <BuilderPortalSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Guided Tours"
        maxWidthClass="max-w-lg"
      >
        {availableTours.length === 0 ? (
          <p className="text-sm text-[#8A8278]">
            Add locations first to see city-specific tours.
          </p>
        ) : (
          <ul className="space-y-2">
            {availableTours.map((tour) => {
              const selected = selectedTourIds.includes(tour.id);
              return (
                <li key={tour.id}>
                  <button
                    type="button"
                    onClick={() => toggleTour(tour.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-[#C4A35A] bg-[#FBF6EA]"
                        : "border-[#EEE8DF] hover:border-[#C4A35A]/60"
                    }`}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#C4A35A]">
                        {cityNames[tour.city_id] ?? "Japan"}
                      </p>
                      <p className="mt-0.5 font-medium text-[#0B1F3A]">
                        {tour.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#0B1F3A]">
                      {tour.duration_hours ? `${tour.duration_hours}h · ` : ""}
                      {formatUsd(tourPrice(tour))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BuilderPortalSheet>
    </SectionBlock>
  );
}
