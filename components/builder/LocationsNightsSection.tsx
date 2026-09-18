"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  MapPinned,
  Pencil,
} from "lucide-react";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import type {
  PbCity,
  PbCityMovement,
  PbHub,
  PbTransitMode,
} from "@/lib/pocketbase/client";
import {
  matchSeasonalHighlights,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import { validateCityRoute } from "@/lib/routeValidator";
import { useBuilderStore, type LocationStop } from "@/store/useBuilderStore";
import { SectionContinue } from "./SectionContinue";
import { SectionBlock } from "./ui";
import { useLazyModalMount } from "./modals/useLazyModalMount";

const LocationsEditorModal = dynamic(
  () =>
    import("./modals/LocationsEditorModal").then((m) => ({
      default: m.LocationsEditorModal,
    })),
  { ssr: false }
);

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

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const modalMounted = useLazyModalMount(isLocationModalOpen);
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
  const cityLabelMap = useMemo(() => buildCityMap(cities), [cities]);

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
            const name = getCityName(l.cityId, cityLabelMap);
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

  const openEditor = () => setIsLocationModalOpen(true);

  return (
    <SectionBlock
      number={3}
      title="Locations & Nights"
      id="section-locations"
      icon="map"
      summary={summary}
    >
      <p className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
        Plan <span className="font-semibold text-zinc-200">time in each city</span>{" "}
        and transit between stops. Hotel booking is separate in Step 4 (default:{" "}
        no hotel / self-arranged).
      </p>

      {!arrivalDate ? (
        <p className="mb-3 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          Set an arrival date in Step 1 to unlock seasonal concierge suggestions.
        </p>
      ) : null}

      <RouteSummaryWidget
        locations={locations}
        cityMap={cityMap}
        totalNights={totalNights}
        durationDays={durationDays}
        matches={matches}
        warningCount={routeWarnings.length}
        onClick={openEditor}
      />

      <button
        type="button"
        onClick={openEditor}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#C4A35A]/50 bg-zinc-950 py-2.5 text-sm font-semibold text-white transition hover:border-[#C4A35A] hover:bg-[#0B1F3A]"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {locations.length === 0 ? "Build your route" : "Edit Route"}
      </button>

      <SectionContinue next={4} label="Continue to Hotels" />

      {modalMounted ? (
      <LocationsEditorModal
        open={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locations={locations}
        cities={cities}
        cityMap={cityMap}
        dateByKey={dateByKey}
        arrivalHub={arrivalHub}
        hubShortName={hubShortName}
        expandedKey={expandedKey}
        setExpandedKey={setExpandedKey}
        seasonalMatches={seasonalMatches}
        selectedTourIds={selectedTourIds}
        routeWarnings={routeWarnings}
        routeToast={routeToast}
        totalNights={totalNights}
        durationDays={durationDays}
        matches={matches}
        lastCityId={lastCityId}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        onReorder={handleReorder}
        onNights={(key, n) => setLocationNights(key, n)}
        onVisitType={(key, t) => setLocationVisitType(key, t)}
        onTransit={(key, t) => setLocationTransitType(key, t)}
        onRemove={(key) => removeLocation(key)}
        onAddTour={(id) => {
          if (!selectedTourIds.includes(id)) toggleTour(id);
        }}
        onAddCity={(cityId) => {
          if (!addLocation(cityId)) {
            setRouteToast("Consecutive identical cities are not allowed.");
            return false;
          }
          return true;
        }}
      />
      ) : null}

    </SectionBlock>
  );
}

function RouteSummaryWidget({
  locations,
  cityMap,
  totalNights,
  durationDays,
  matches,
  warningCount,
  onClick,
}: {
  locations: LocationStop[];
  cityMap: Record<string, PbCity>;
  totalNights: number;
  durationDays: number;
  matches: boolean;
  warningCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[1.35rem] border border-zinc-800 bg-[#1C1C1E] p-4 text-left transition hover:border-[#C4A35A]/45 hover:bg-[#222226] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            City nights · not hotels
          </p>
          <p className="mt-1 font-display text-xl text-white sm:text-2xl">
            {locations.length === 0
              ? "No cities yet"
              : `${locations.length} stop${locations.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <MapPinned className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {locations.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {locations.map((loc, i) => {
            const name =
              cityMap[loc.cityId]?.name ?? getCityName(loc.cityId);
            const nightsLabel =
              loc.visitType === "arrival"
                ? "arr"
                : loc.visitType === "departure"
                  ? "dep"
                  : `${loc.nights}n`;
            return (
              <span key={loc.key} className="inline-flex items-center gap-1.5">
                {i > 0 ? (
                  <span className="text-zinc-600" aria-hidden>
                    →
                  </span>
                ) : null}
                <span className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200">
                  <span className="break-words font-semibold leading-tight text-white">
                    {name}
                  </span>
                  <span className="shrink-0 text-zinc-500">{nightsLabel}</span>
                </span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Tap to add cities, set nights per stop, and choose transit. Hotels are
          optional in the next step.
        </p>
      )}

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-800/80 pt-3">
        <div className="min-w-0">
          <p
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              matches ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {matches ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            {totalNights} night{totalNights === 1 ? "" : "s"}
            {matches
              ? ` · Matches ${durationDays}-day trip`
              : ` · Need ${durationDays} for your trip`}
          </p>
          {warningCount > 0 ? (
            <p className="mt-1 text-[11px] text-[#E8D5A3]">
              {warningCount} route note{warningCount === 1 ? "" : "s"} — open
              editor to review
            </p>
          ) : null}
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-[#C4A35A]"
          aria-hidden
        />
      </div>
    </button>
  );
}
