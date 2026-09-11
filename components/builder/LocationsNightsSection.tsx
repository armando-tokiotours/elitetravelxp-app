"use client";

import { Reorder, useDragControls } from "framer-motion";
import { useMemo, useState } from "react";
import type { PbCity, PbTransitMode } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import {
  matchSeasonalHighlights,
  matchesForCity,
  type SeasonalHighlight,
  type SeasonalMatch,
} from "@/lib/seasonalMatcher";
import { useBuilderStore, type LocationStop } from "@/store/useBuilderStore";
import { BuilderPortalSheet } from "./BuilderPortalSheet";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import {
  FieldLabel,
  NightCounter,
  SectionBlock,
  SelectField,
} from "./ui";
import { SectionContinue } from "./SectionContinue";

export function LocationsNightsSection({
  cities,
  transitModes,
  seasonalHighlights = [],
}: {
  cities: PbCity[];
  transitModes: PbTransitMode[];
  seasonalHighlights?: SeasonalHighlight[];
}) {
  const locations = useBuilderStore((s) => s.locations);
  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const transitModeId = useBuilderStore((s) => s.transitModeId);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const removeLocation = useBuilderStore((s) => s.removeLocation);
  const setLocationNights = useBuilderStore((s) => s.setLocationNights);
  const reorderLocations = useBuilderStore((s) => s.reorderLocations);
  const setTransitModeId = useBuilderStore((s) => s.setTransitModeId);
  const toggleTour = useBuilderStore((s) => s.toggleTour);

  const [pickerOpen, setPickerOpen] = useState(false);

  const totalNights = locations.reduce((s, l) => s + l.nights, 0);
  const matches = totalNights === durationDays;

  const availableCities = useMemo(
    () => cities.filter((c) => !locations.some((l) => l.cityId === c.id)),
    [cities, locations]
  );

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
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
          .map((l) => `${cityMap[l.cityId]?.name ?? "City"} (${l.nights}n)`)
          .join(", ");

  return (
    <SectionBlock
      number={3}
      title="Locations & Nights"
      id="section-locations"
      icon="map"
      summary={summary}
    >
      {!arrivalDate ? (
        <p className="mb-3 rounded-xl bg-[#F7F3EC] px-3 py-2 text-xs text-[#8A8278]">
          Set an arrival date in Step 1 to unlock seasonal concierge suggestions.
        </p>
      ) : null}

      {locations.length === 0 ? (
        <p className="mb-4 text-sm text-[#8A8278]">
          Add cities to shape your route. Drag to reorder travel order.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={locations}
          onReorder={reorderLocations}
          className="mb-4 flex flex-col gap-2.5"
        >
          {locations.map((loc) => (
            <LocationRow
              key={loc.key}
              loc={loc}
              city={cityMap[loc.cityId]}
              suggestions={matchesForCity(seasonalMatches, loc.cityId)}
              selectedTourIds={selectedTourIds}
              onNights={(n) => setLocationNights(loc.key, n)}
              onRemove={() => removeLocation(loc.key)}
              onAddTour={(id) => {
                if (!selectedTourIds.includes(id)) toggleTour(id);
              }}
            />
          ))}
        </Reorder.Group>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={availableCities.length === 0}
        className="mb-5 w-full rounded-full border border-dashed border-[#C4A35A] bg-[#FBF8F2] py-3 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#F3EBD9] disabled:opacity-40"
      >
        + Add Location
      </button>

      <div
        className={`mb-5 rounded-xl px-4 py-3 text-sm ${
          matches
            ? "bg-[#EAF3EA] text-[#1F5C3A]"
            : "bg-[#F8EDE8] text-[#8A3B2A]"
        }`}
      >
        Total nights: {totalNights}{" "}
        {matches
          ? `(Matches your ${durationDays}-day trip)`
          : `(Should match your ${durationDays}-day trip)`}
      </div>

      <div>
        <FieldLabel>Travel from location to location</FieldLabel>
        <SelectField
          value={transitModeId ?? ""}
          onChange={(v) => setTransitModeId(v || null)}
          options={transitModes.map((t) => ({
            value: t.id,
            label: t.label,
          }))}
          placeholder="Select transit mode"
        />
      </div>

      <BuilderPortalSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add Location"
      >
        <ul className="space-y-2">
          {availableCities.map((city) => {
            const filename = cityPhoto(city);
            const img = filename
              ? pbFileUrl(city.collectionId, city.id, filename, "100x100")
              : "";
            return (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => {
                    addLocation(city.id);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#EEE8DF] px-3 py-2.5 text-left hover:border-[#C4A35A]"
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
                  <span className="font-medium text-[#0B1F3A]">
                    {city.name}
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

function LocationRow({
  loc,
  city,
  suggestions,
  selectedTourIds,
  onNights,
  onRemove,
  onAddTour,
}: {
  loc: LocationStop;
  city?: PbCity;
  suggestions: SeasonalMatch[];
  selectedTourIds: string[];
  onNights: (n: number) => void;
  onRemove: () => void;
  onAddTour: (tourId: string) => void;
}) {
  const controls = useDragControls();
  const filename = city ? cityPhoto(city) : "";
  const img =
    filename && city
      ? pbFileUrl(city.collectionId, city.id, filename, "80x80")
      : "";

  return (
    <Reorder.Item
      value={loc}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-[#EEE8DF] bg-[#FBF8F2] px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none px-1 text-[#C4A35A] active:cursor-grabbing"
        >
          <DragIcon />
        </button>

        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[#E8E2D9]" />
        )}

        <span className="min-w-0 flex-1 truncate font-medium text-[#0B1F3A]">
          {city?.name ?? "City"}
        </span>

        <NightCounter value={loc.nights} onChange={onNights} />

        <button
          type="button"
          aria-label="Remove location"
          onClick={onRemove}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-[#8A8278] hover:bg-white hover:text-[#8A3B2A]"
        >
          ×
        </button>
      </div>

      {suggestions.map((m) => (
        <ConciergeSuggestionCard
          key={`${m.highlight.id}-${m.cityId}`}
          match={m}
          tourAlreadyAdded={
            !!m.highlight.suggested_tour_id &&
            selectedTourIds.includes(m.highlight.suggested_tour_id)
          }
          onAddTour={onAddTour}
        />
      ))}
    </Reorder.Item>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
      <circle cx="4" cy="3" r="1.4" />
      <circle cx="10" cy="3" r="1.4" />
      <circle cx="4" cy="9" r="1.4" />
      <circle cx="10" cy="9" r="1.4" />
      <circle cx="4" cy="15" r="1.4" />
      <circle cx="10" cy="15" r="1.4" />
    </svg>
  );
}
