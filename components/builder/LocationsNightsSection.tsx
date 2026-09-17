"use client";

import { Reorder } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { canAppendCity } from "@/lib/locationRules";
import type {
  PbCity,
  PbCityMovement,
  PbHub,
  PbTransitMode,
} from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import { validateCityRoute } from "@/lib/routeValidator";
import {
  matchSeasonalHighlights,
  matchesForCity,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import {
  useBuilderStore,
  type LocationStop,
} from "@/store/useBuilderStore";
import { BuilderPortalSheet } from "./BuilderPortalSheet";
import { CityAccordionItem } from "./CityAccordionItem";
import { SectionContinue } from "./SectionContinue";
import { SectionBlock } from "./ui";

export function LocationsNightsSection({
  cities,
  hubs = [],
  cityMovements = [],
  transitModes: _transitModes = [],
  seasonalHighlights = [],
}: {
  cities: PbCity[];
  hubs?: PbHub[];
  cityMovements?: PbCityMovement[];
  transitModes?: PbTransitMode[];
  seasonalHighlights?: SeasonalHighlight[];
}) {
  void _transitModes;

  const locations = useBuilderStore((s) => s.locations);
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const removeLocation = useBuilderStore((s) => s.removeLocation);
  const setLocationNights = useBuilderStore((s) => s.setLocationNights);
  const setLocationVisitType = useBuilderStore((s) => s.setLocationVisitType);
  const setLocationTransitType = useBuilderStore(
    (s) => s.setLocationTransitType
  );
  const reorderLocations = useBuilderStore((s) => s.reorderLocations);
  const toggleTour = useBuilderStore((s) => s.toggleTour);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [routeToast, setRouteToast] = useState<string | null>(null);

  useEffect(() => {
    if (locations.length === 0) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey((prev) =>
      prev && locations.some((l) => l.key === prev) ? prev : locations[0].key
    );
  }, [locations]);

  useEffect(() => {
    if (!routeToast) return;
    const t = window.setTimeout(() => setRouteToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [routeToast]);

  const totalNights = locations.reduce((s, l) => s + l.nights, 0);
  const matches = totalNights === durationDays;
  const lastCityId = locations[locations.length - 1]?.cityId ?? null;

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
  );

  const dateRanges = useMemo(
    () => calculateCityDateRanges(arrivalDate, locations),
    [arrivalDate, locations]
  );

  const dateByKey = useMemo(
    () => Object.fromEntries(dateRanges.map((r) => [r.key ?? r.cityId, r])),
    [dateRanges]
  );

  const arrivalHub = hubs.find((h) => h.id === arrivalTransferId) ?? null;
  const departureHub = hubs.find((h) => h.id === departureTransferId) ?? null;

  const routeWarnings = useMemo(
    () =>
      validateCityRoute(
        arrivalHub,
        departureHub,
        locations,
        cities,
        cityMovements
      ),
    [arrivalHub, departureHub, locations, cities, cityMovements]
  );

  const seasonalMatches = useMemo(
    () =>
      matchSeasonalHighlights(
        seasonalHighlights,
        arrivalDate,
        locations.map((l) => ({ cityId: l.cityId, nights: l.nights }))
      ),
    [seasonalHighlights, arrivalDate, locations]
  );

  const summary =
    locations.length === 0
      ? "No cities yet"
      : locations
          .map((l) => {
            const name = cityMap[l.cityId]?.name ?? "City";
            if (l.visitType === "arrival") return `${name} (arrival)`;
            if (l.visitType === "departure") return `${name} (departure)`;
            return `${name} (${l.nights}n)`;
          })
          .join(", ");

  const hubShortName = (hub: PbHub | null) => {
    if (!hub) return "Arrival";
    return hub.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || hub.name;
  };

  const handleReorder = (next: LocationStop[]) => {
    const ok = reorderLocations(next);
    if (!ok) {
      setRouteToast("Consecutive identical cities are not allowed.");
    }
  };

  return (
    <SectionBlock
      number={3}
      title="Locations & Nights"
      id="section-locations"
      icon="map"
      summary={summary}
    >
      {!arrivalDate ? (
        <p className="mb-3 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          Set an arrival date in Step 1 to unlock seasonal concierge suggestions.
        </p>
      ) : null}

      {routeToast ? (
        <div
          role="status"
          className="mb-3 rounded-xl border border-[#C4A35A]/50 bg-zinc-950 px-3.5 py-2.5 text-sm text-[#E8D5A3]"
        >
          {routeToast}
        </div>
      ) : null}

      {routeWarnings.map((w) => (
        <div
          key={w.type}
          className={`mb-3 rounded-xl px-3.5 py-3 text-sm ${
            w.type === "inefficient"
              ? "border border-[#C4A35A]/35 bg-zinc-950 text-zinc-300"
              : "border border-[#C4A35A]/50 bg-zinc-950 text-[#E8D5A3]"
          }`}
        >
          <p className="font-semibold text-white">
            {w.type === "inefficient" ? "💡 " : "⚠️ "}
            {w.title}
          </p>
          <p className="mt-1 leading-relaxed">{w.body}</p>
        </div>
      ))}

      {locations.length === 0 ? (
        <p className="mb-4 text-sm text-zinc-400">
          Add cities to shape your route. Drag to reorder travel order. The same
          city can appear more than once (e.g. round-trip), but not consecutively.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={locations}
          onReorder={handleReorder}
          className="mb-4 flex flex-col gap-3"
        >
          {locations.map((loc, index) => {
            const prev = index > 0 ? locations[index - 1] : null;
            const fromLabel =
              index === 0
                ? hubShortName(arrivalHub)
                : cityMap[prev!.cityId]?.name ?? "Previous city";
            const range = dateByKey[loc.key];
            return (
              <CityAccordionItem
                key={loc.key}
                loc={loc}
                city={cityMap[loc.cityId]}
                dateLabel={range?.label ?? ""}
                fromLabel={fromLabel}
                index={index}
                totalLocations={locations.length}
                expanded={expandedKey === loc.key}
                onToggle={() =>
                  setExpandedKey((k) => (k === loc.key ? null : loc.key))
                }
                suggestions={matchesForCity(seasonalMatches, loc.cityId)}
                selectedTourIds={selectedTourIds}
                onNights={(n) => setLocationNights(loc.key, n)}
                onVisitType={(t) => setLocationVisitType(loc.key, t)}
                onTransit={(t) => setLocationTransitType(loc.key, t)}
                onRemove={() => removeLocation(loc.key)}
                onAddTour={(id) => {
                  if (!selectedTourIds.includes(id)) toggleTour(id);
                }}
              />
            );
          })}
        </Reorder.Group>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={cities.length === 0}
        className="mb-5 w-full rounded-full border border-dashed border-[#C4A35A] bg-zinc-950 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
      >
        + Add Location
      </button>

      <div
        className={`mb-5 rounded-xl px-4 py-3 text-sm ${
          matches
            ? "border border-emerald-800/60 bg-emerald-950/40 text-emerald-200"
            : "border border-red-900/50 bg-red-950/30 text-red-200"
        }`}
      >
        Total nights: {totalNights}{" "}
        {matches
          ? `(Matches your ${durationDays}-day trip)`
          : `(Should match your ${durationDays}-day trip)`}
      </div>

      <BuilderPortalSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add Location"
      >
        {lastCityId ? (
          <p className="mb-3 text-xs text-zinc-400">
            You can add a city again later for a round-trip, but not immediately
            after itself.
          </p>
        ) : null}
        <ul className="space-y-2">
          {cities.map((city) => {
            const filename = cityPhoto(city);
            const img = filename
              ? pbFileUrl(city.collectionId, city.id, filename, "100x100")
              : "";
            const disabled = !canAppendCity(locations, city.id);
            return (
              <li key={city.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!addLocation(city.id)) {
                      setRouteToast(
                        "Consecutive identical cities are not allowed."
                      );
                      return;
                    }
                    setPickerOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    disabled
                      ? "cursor-not-allowed border-zinc-800 bg-zinc-950 opacity-50"
                      : "border-zinc-800 hover:border-[#C4A35A]"
                  }`}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="h-11 w-11 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-lg bg-[#E8E2D9]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-white">
                      {city.name}
                    </span>
                    {disabled ? (
                      <span className="text-xs text-zinc-400">
                        Already last in your route
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BuilderPortalSheet>
      <SectionContinue next={4} label="Continue to Hotels" />
    </SectionBlock>
  );
}
