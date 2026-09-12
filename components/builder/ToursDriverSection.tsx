"use client";

import { useMemo, useState } from "react";
import type { PbCity, PbTour } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import {
  canAddTourToCity,
  cityTourCapacityHours,
  selectedTourHours,
  TOUR_HOURS_PER_NIGHT,
} from "@/lib/tourValidator";
import {
  matchSeasonalHighlights,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import { ExperiencesDrawer } from "./ExperiencesDrawer";
import { FieldLabel, PillToggle, SectionBlock } from "./ui";

export function ToursDriverSection({
  tours,
  cities = [],
  cityNames,
  allowToursOnTravelDays = false,
  seasonalHighlights = [],
}: {
  tours: PbTour[];
  cities?: PbCity[];
  cityNames: Record<string, string>;
  allowToursOnTravelDays?: boolean;
  seasonalHighlights?: SeasonalHighlight[];
}) {
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const selectedToursByCity = useBuilderStore((s) => s.selectedToursByCity);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const needDriver = useBuilderStore((s) => s.needDriver);
  const toggleTour = useBuilderStore((s) => s.toggleTour);
  const toggleCityTour = useBuilderStore((s) => s.toggleCityTour);
  const setEliteConcierge = useBuilderStore((s) => s.setEliteConcierge);
  const setNeedDriver = useBuilderStore((s) => s.setNeedDriver);
  const durationDays = useBuilderStore((s) => s.durationDays);

  const [drawerCityId, setDrawerCityId] = useState<string | null>(null);

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
  );

  /** Stay nights aggregated per city (arrival/departure waypoints excluded). */
  const cityStops = useMemo(() => {
    const map = new Map<string, number>();
    for (const loc of locations) {
      if (loc.visitType && loc.visitType !== "stay") continue;
      if (loc.nights <= 0) continue;
      map.set(loc.cityId, (map.get(loc.cityId) ?? 0) + loc.nights);
    }
    // Preserve Step 3 order
    const ordered: { cityId: string; nights: number }[] = [];
    const seen = new Set<string>();
    for (const loc of locations) {
      if (seen.has(loc.cityId)) continue;
      const nights = map.get(loc.cityId);
      if (nights == null || nights <= 0) continue;
      seen.add(loc.cityId);
      ordered.push({ cityId: loc.cityId, nights });
    }
    return ordered;
  }, [locations]);

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

  const drawerCity = drawerCityId
    ? cityStops.find((c) => c.cityId === drawerCityId)
    : null;
  const drawerTours = useMemo(() => {
    if (!drawerCityId) return [];
    return tours.filter((t) => t.city_id === drawerCityId);
  }, [tours, drawerCityId]);

  const tourCount = selectedTourIds.length;
  const summary = isEliteConcierge
    ? "Elite Concierge package"
    : `${
        tourCount === 0
          ? "No tours"
          : `${tourCount} experience${tourCount === 1 ? "" : "s"}`
      } · Chauffeur: ${needDriver ? "Yes" : "No"}`;

  return (
    <SectionBlock
      number={5}
      title="Tours & Experiences"
      id="section-tours"
      icon="tour"
      summary={summary}
    >
      {/* Elite Concierge upsell */}
      <div
        className={`mb-5 overflow-hidden rounded-2xl border px-4 py-4 sm:px-5 ${
          isEliteConcierge
            ? "border-[#C4A35A] bg-[#FBF6EA]"
            : "border-[#C4A35A]/45 bg-gradient-to-br from-[#FBF6EA] to-white"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
          Premium
        </p>
        <h3 className="mt-1 font-display text-xl text-[#0B1F3A] sm:text-2xl">
          ✨ Elite Concierge Day-by-Day Design
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5C6570]">
          Skip the individual planning. Have a dedicated luxury concierge curate
          your entire day-by-day itinerary, including exclusive dining
          reservations, hidden sights, and private drivers for your entire trip.
        </p>
        <button
          type="button"
          onClick={() => setEliteConcierge(!isEliteConcierge)}
          className={`mt-4 w-full rounded-full py-3 text-sm font-semibold transition sm:w-auto sm:px-6 ${
            isEliteConcierge
              ? "bg-[#0B1F3A] text-white"
              : "border border-[#C4A35A] bg-white text-[#0B1F3A] hover:bg-[#0B1F3A] hover:text-white"
          }`}
        >
          {isEliteConcierge
            ? "✓ Elite Concierge Added"
            : "Add Elite Concierge Package"}
        </button>
      </div>

      {!isEliteConcierge ? (
        <div className="mb-5 rounded-xl bg-[#F7F3EC] px-4 py-3 text-sm text-[#5C6570]">
          About {TOUR_HOURS_PER_NIGHT}h of experiences recommended per night.{" "}
          {allowToursOnTravelDays
            ? `~${tourableDays} day${tourableDays === 1 ? "" : "s"} available.`
            : `~${tourableDays} available day${tourableDays === 1 ? "" : "s"} after ${travelDays} travel day${travelDays === 1 ? "" : "s"}.`}
        </div>
      ) : (
        <p className="mb-5 rounded-xl border border-[#C4A35A]/30 bg-[#FBF6EA] px-4 py-3 text-sm text-[#6B5420]">
          Individual city browsing is paused while Elite Concierge is selected.
          Your concierge will design the full day-by-day plan.
        </p>
      )}

      {!isEliteConcierge && seasonalMatches.length > 0 ? (
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
                if (!m.cityId) {
                  if (!selectedTourIds.includes(id)) toggleTour(id);
                  return;
                }
                const nights =
                  cityStops.find((c) => c.cityId === m.cityId)?.nights ?? 0;
                const citySelected = selectedToursByCity[m.cityId] ?? [];
                const check = canAddTourToCity({
                  cityName: cityNames[m.cityId] ?? "this city",
                  nights,
                  selectedTourIds: citySelected,
                  tourId: id,
                  tours,
                });
                if (!check.ok) return;
                if (!citySelected.includes(id)) toggleCityTour(m.cityId, id);
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mb-6">
        <FieldLabel>Your cities</FieldLabel>
        {cityStops.length === 0 ? (
          <p className="text-sm text-[#8A8278]">
            Add stay cities in Step 3 to browse experiences.
          </p>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {cityStops.map((stop) => {
              const city = cityMap[stop.cityId];
              const name = cityNames[stop.cityId] ?? city?.name ?? "City";
              const filename = city ? cityPhoto(city) : "";
              const img =
                filename && city
                  ? pbFileUrl(city.collectionId, city.id, filename, "200x140")
                  : "";
              const cityTourIds = selectedToursByCity[stop.cityId] ?? [];
              const used = selectedTourHours(cityTourIds, tours);
              const capacity = cityTourCapacityHours(stop.nights);
              const muted = isEliteConcierge;

              return (
                <li
                  key={stop.cityId}
                  className={`w-[11.5rem] shrink-0 overflow-hidden rounded-2xl border bg-white ${
                    muted
                      ? "border-[#EEE8DF] opacity-45"
                      : "border-[#EEE8DF]"
                  }`}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] px-3 pb-2">
                      <span className="font-display text-lg text-white/90">
                        {name}
                      </span>
                    </div>
                  )}
                  <div className="px-3 py-3">
                    <p className="truncate font-medium text-[#0B1F3A]">{name}</p>
                    <p className="text-xs text-[#C4A35A]">
                      {stop.nights} night{stop.nights === 1 ? "" : "s"}
                      {!muted && cityTourIds.length > 0
                        ? ` · ${cityTourIds.length} selected`
                        : ""}
                    </p>
                    {!muted ? (
                      <p className="mt-0.5 text-[11px] text-[#A39A8E]">
                        {used}/{capacity}h
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={muted}
                      onClick={() => setDrawerCityId(stop.cityId)}
                      className="mt-3 w-full rounded-full border border-[#0B1F3A] py-2 text-xs font-semibold text-[#0B1F3A] transition hover:bg-[#0B1F3A] hover:text-white disabled:cursor-not-allowed disabled:border-[#D9D2C7] disabled:text-[#A39A8E] disabled:hover:bg-transparent"
                    >
                      Browse Experiences ➔
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <FieldLabel>Private chauffeur</FieldLabel>
        <PillToggle value={needDriver} onChange={setNeedDriver} />
      </div>

      <ExperiencesDrawer
        open={!!drawerCity}
        onClose={() => setDrawerCityId(null)}
        cityName={
          drawerCity
            ? cityNames[drawerCity.cityId] ??
              cityMap[drawerCity.cityId]?.name ??
              "City"
            : ""
        }
        nights={drawerCity?.nights ?? 0}
        tours={drawerTours}
        selectedTourIds={
          drawerCity ? selectedToursByCity[drawerCity.cityId] ?? [] : []
        }
        onToggleTour={(tourId) => {
          if (!drawerCity) return { ok: false };
          const citySelected =
            selectedToursByCity[drawerCity.cityId] ?? [];
          const already = citySelected.includes(tourId);
          if (already) {
            toggleCityTour(drawerCity.cityId, tourId);
            return { ok: true };
          }
          const check = canAddTourToCity({
            cityName:
              cityNames[drawerCity.cityId] ??
              cityMap[drawerCity.cityId]?.name ??
              "this city",
            nights: drawerCity.nights,
            selectedTourIds: citySelected,
            tourId,
            tours,
          });
          if (!check.ok) {
            return { ok: false, message: check.message };
          }
          toggleCityTour(drawerCity.cityId, tourId);
          return { ok: true };
        }}
      />
    </SectionBlock>
  );
}
