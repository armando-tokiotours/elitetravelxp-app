"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PbChauffeurRate,
  PbCity,
  PbTour,
  PbVehicle,
} from "@/lib/pocketbase/client";
import {
  cityPhoto,
  pbFileUrl,
  tourPrice,
} from "@/lib/pocketbase/client";
import {
  countBillableChauffeurDays,
  isBillableChauffeurDay,
  type DailyChauffeurSelection,
  type DriverMode,
} from "@/lib/chauffeurSelections";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import { formatUsd } from "@/lib/builder-pricing";
import type { SelectedTour } from "@/lib/selectedTours";
import { toursOnDate } from "@/lib/selectedTours";
import {
  canAddTourOnDate,
  MAX_TOUR_HOURS_PER_DAY,
  TOUR_DAY_PACKED_MESSAGE,
} from "@/lib/tourValidator";
import {
  matchSeasonalHighlights,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import {
  formatTransferPriceRange,
  priceFleetChauffeurDay,
} from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";
import { ExperiencesDrawer } from "./ExperiencesDrawer";
import { ExplainerTriggerButton } from "./ExplainerTriggerButton";
import { FieldLabel, SectionBlock } from "./ui";

export function ToursDriverSection({
  tours,
  cities = [],
  cityNames,
  allowToursOnTravelDays = false,
  seasonalHighlights = [],
  vehicles = [],
  chauffeurRates = [],
}: {
  tours: PbTour[];
  cities?: PbCity[];
  cityNames: Record<string, string>;
  allowToursOnTravelDays?: boolean;
  seasonalHighlights?: SeasonalHighlight[];
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
}) {
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const selectedToursByCity = useBuilderStore((s) => s.selectedToursByCity);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const chauffeurSelections = useBuilderStore((s) => s.chauffeurSelections);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const toggleTour = useBuilderStore((s) => s.toggleTour);
  const addCityTour = useBuilderStore((s) => s.addCityTour);
  const removeCityTour = useBuilderStore((s) => s.removeCityTour);
  const setEliteConcierge = useBuilderStore((s) => s.setEliteConcierge);
  const setChauffeurDayMode = useBuilderStore((s) => s.setChauffeurDayMode);
  const toggleChauffeurDayTour = useBuilderStore(
    (s) => s.toggleChauffeurDayTour
  );
  const durationDays = useBuilderStore((s) => s.durationDays);
  const totalPax = adults + children;

  const [drawerCityId, setDrawerCityId] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
  );

  /** Stay stops only, Step 3 order (read-only — no reorder). */
  const stayStops = useMemo(
    () =>
      locations.filter(
        (loc) =>
          loc.visitType !== "arrival" &&
          loc.visitType !== "departure" &&
          loc.nights > 0
      ),
    [locations]
  );

  /** Aggregate nights per city for capacity rules when the same city repeats. */
  const nightsByCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const loc of stayStops) {
      map.set(loc.cityId, (map.get(loc.cityId) ?? 0) + loc.nights);
    }
    return map;
  }, [stayStops]);

  useEffect(() => {
    if (stayStops.length === 0) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey((prev) =>
      prev && stayStops.some((l) => l.key === prev) ? prev : stayStops[0].key
    );
  }, [stayStops]);

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

  const drawerCityNights = drawerCityId
    ? (nightsByCity.get(drawerCityId) ?? 0)
    : 0;
  const drawerTours = useMemo(() => {
    if (!drawerCityId) return [];
    return tours.filter((t) => t.city_id === drawerCityId);
  }, [tours, drawerCityId]);

  const chauffeurDayCount = countBillableChauffeurDays(chauffeurSelections);
  const tourCount = selectedTourIds.length;
  const summary = isEliteConcierge
    ? "Elite Concierge package"
    : `${
        tourCount === 0
          ? "No tours"
          : `${tourCount} experience${tourCount === 1 ? "" : "s"}`
      } · Chauffeur: ${
        chauffeurDayCount === 0
          ? "No"
          : `${chauffeurDayCount} day${chauffeurDayCount === 1 ? "" : "s"}`
      }`;

  return (
    <SectionBlock
      number={5}
      title="Tours & Experiences"
      id="section-tours"
      icon="tour"
      summary={summary}
    >
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
          Maximum {MAX_TOUR_HOURS_PER_DAY} hours of activities allowed per day.{" "}
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
                const cityRows = selectedToursMap[m.cityId] ?? [];
                const citySelected = selectedToursByCity[m.cityId] ?? [];
                const tour = tours.find((t) => t.id === id);
                if (!tour) return;
                const days = chauffeurDaysForCity(
                  arrivalDate,
                  locations,
                  m.cityId
                );
                const date = days[0]?.date;
                if (!date) return;
                const check = canAddTourOnDate({
                  selectedRows: cityRows,
                  scheduledDate: date,
                  newTourDurationHours: Number(tour.duration_hours) || 0,
                  tourId: id,
                });
                if (!check.ok) return;
                if (!citySelected.includes(id)) {
                  addCityTour(m.cityId, {
                    tourId: tour.id,
                    title: tour.title,
                    duration_hours: Number(tour.duration_hours) || 0,
                    scheduledDate: date,
                    price: tourPrice(tour),
                  });
                }
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mb-2">
        <FieldLabel>Your cities</FieldLabel>
        {stayStops.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FBF8F2] p-4 text-sm text-[#8A8278]">
            Add stay cities in Step 3 to browse experiences and book a private
            chauffeur by day.
          </p>
        ) : (
          <div
            className={`flex flex-col gap-3 ${
              isEliteConcierge ? "pointer-events-none opacity-45" : ""
            }`}
          >
            {stayStops.map((stop) => {
              const city = cityMap[stop.cityId];
              const name = cityNames[stop.cityId] ?? city?.name ?? "City";
              const cityRows = selectedToursMap[stop.cityId] ?? [];
              const citySelections = chauffeurSelections[stop.cityId] ?? {};
              const driverDayCount = Object.values(citySelections).filter(
                (sel) => isBillableChauffeurDay(sel)
              ).length;
              const dayOptions = chauffeurDaysForCity(
                arrivalDate,
                locations,
                stop.cityId
              );
              const quote = priceFleetChauffeurDay({
                cityId: stop.cityId,
                totalPax,
                vehicles,
                rates: chauffeurRates,
              });
              const dailyLabel =
                quote?.fromRates && quote.min > 0
                  ? formatTransferPriceRange(quote.min, quote.max)
                  : null;
              const fleetLabel = quote?.fleet?.label?.replace("×", "x") ?? null;

              return (
                <Step5CityAccordion
                  key={stop.key}
                  city={city}
                  cityName={name}
                  expanded={expandedKey === stop.key}
                  onToggle={() =>
                    setExpandedKey((k) =>
                      k === stop.key ? null : stop.key
                    )
                  }
                  experienceCount={cityRows.length}
                  driverDayCount={driverDayCount}
                  selectedTours={cityRows}
                  dayOptions={dayOptions}
                  onRemoveTour={(tourId) =>
                    removeCityTour(stop.cityId, tourId)
                  }
                  onBrowse={() => setDrawerCityId(stop.cityId)}
                  dailyRateLabel={dailyLabel}
                  fleetLabel={fleetLabel}
                  daySelections={citySelections}
                  cityId={stop.cityId}
                  onSetDayMode={(date, mode) =>
                    setChauffeurDayMode(stop.cityId, date, mode)
                  }
                  onToggleDayTour={(date, tourId) =>
                    toggleChauffeurDayTour(stop.cityId, date, tourId)
                  }
                  arrivalDateMissing={!arrivalDate}
                />
              );
            })}
          </div>
        )}
      </div>

      <ExperiencesDrawer
        open={!!drawerCityId}
        onClose={() => setDrawerCityId(null)}
        cityName={
          drawerCityId
            ? cityNames[drawerCityId] ??
              cityMap[drawerCityId]?.name ??
              "City"
            : ""
        }
        nights={drawerCityNights}
        tours={drawerTours}
        selectedTours={
          drawerCityId ? selectedToursMap[drawerCityId] ?? [] : []
        }
        dayOptions={
          drawerCityId
            ? chauffeurDaysForCity(arrivalDate, locations, drawerCityId)
            : []
        }
        onRemoveTour={(tourId) => {
          if (!drawerCityId) return;
          removeCityTour(drawerCityId, tourId);
        }}
        onAddTour={(tour, scheduledDate) => {
          if (!drawerCityId) return { ok: false };
          const cityRows = selectedToursMap[drawerCityId] ?? [];
          const citySelected = selectedToursByCity[drawerCityId] ?? [];
          const duration_hours = Number(tour.duration_hours) || 0;
          const check = canAddTourOnDate({
            selectedRows: cityRows,
            scheduledDate,
            newTourDurationHours: duration_hours,
            tourId: tour.id,
          });
          if (!check.ok) {
            return { ok: false, message: check.message ?? TOUR_DAY_PACKED_MESSAGE };
          }
          const ok = addCityTour(drawerCityId, {
            tourId: tour.id,
            title: tour.title,
            duration_hours,
            scheduledDate,
            price: tourPrice(tour),
          });
          return {
            ok,
            message: ok ? undefined : TOUR_DAY_PACKED_MESSAGE,
          };
        }}
      />
    </SectionBlock>
  );
}

function Step5CityAccordion({
  city,
  cityName,
  expanded,
  onToggle,
  experienceCount,
  driverDayCount,
  selectedTours,
  dayOptions,
  onRemoveTour,
  onBrowse,
  dailyRateLabel,
  fleetLabel,
  daySelections,
  cityId,
  onSetDayMode,
  onToggleDayTour,
  arrivalDateMissing,
}: {
  city?: PbCity;
  cityName: string;
  expanded: boolean;
  onToggle: () => void;
  experienceCount: number;
  driverDayCount: number;
  selectedTours: SelectedTour[];
  dayOptions: ReturnType<typeof chauffeurDaysForCity>;
  onRemoveTour: (tourId: string) => void;
  onBrowse: () => void;
  dailyRateLabel: string | null;
  fleetLabel: string | null;
  daySelections: Record<string, DailyChauffeurSelection>;
  cityId: string;
  onSetDayMode: (date: string, mode: DriverMode) => void;
  onToggleDayTour: (date: string, tourId: string) => void;
  arrivalDateMissing: boolean;
}) {
  const filename = city ? cityPhoto(city) : "";
  const img =
    filename && city
      ? pbFileUrl(city.collectionId, city.id, filename, "200x140")
      : "";

  const summaryBits = [
    `${experienceCount} Experience${experienceCount === 1 ? "" : "s"}`,
    `${driverDayCount} Driver Day${driverDayCount === 1 ? "" : "s"}`,
  ].join(" · ");

  const dateLabel = (iso: string) =>
    dayOptions.find((d) => d.date === iso)?.label ?? iso;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_2px_12px_rgba(11,31,58,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-12 w-16 shrink-0 rounded-lg object-cover sm:w-20"
          />
        ) : (
          <div className="flex h-12 w-16 shrink-0 items-end rounded-lg bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] px-1.5 pb-1 sm:w-20">
            <span className="truncate font-display text-xs text-white/90">
              {cityName}
            </span>
          </div>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-[#0B1F3A]">
            {cityName}
          </span>
          <span className="block truncate text-xs text-[#8A8278]">
            {summaryBits}
          </span>
        </span>
        <span
          className={`shrink-0 text-[#C4A35A] transition ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-[#EEE8DF] px-4 py-4">
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C4A35A]">
                Experiences
              </h4>
              <p className="text-[11px] text-[#A39A8E]">
                Max {MAX_TOUR_HOURS_PER_DAY}h of activities per day
              </p>
            </div>

            {selectedTours.length === 0 ? (
              <p className="mb-3 text-sm text-[#8A8278]">
                No experiences selected yet for {cityName}.
              </p>
            ) : (
              <ul className="mb-3 divide-y divide-[#F0EAE1] rounded-xl border border-[#EEE8DF] bg-[#FBF8F2]">
                {selectedTours.map((tour) => {
                  const hours = Number(tour.duration_hours) || 0;
                  return (
                    <li
                      key={`${tour.tourId}-${tour.scheduledDate}`}
                      className="flex items-start justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#0B1F3A]">
                          {tour.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8A8278]">
                          {tour.scheduledDate
                            ? dateLabel(tour.scheduledDate)
                            : "Date not set"}
                          {hours > 0 ? ` · ${hours}h` : ""}
                          {tour.price > 0 ? ` · ${formatUsd(tour.price)}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${tour.title}`}
                        onClick={() => onRemoveTour(tour.tourId)}
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8A8278] hover:bg-white hover:text-[#8A3B2A]"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={onBrowse}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#0B1F3A] bg-white py-2.5 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#0B1F3A] hover:text-white"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0B1F3A] text-[9px] text-white"
                aria-hidden
              >
                ▶
              </span>
              Browse City Experiences
            </button>
          </section>

          <section>
            <div className="mb-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C4A35A]">
                Private Driver &amp; Vehicle
              </h4>
              <p className="mt-1 text-sm text-[#5C6570]">
                {dailyRateLabel ? (
                  <>
                    Daily rate:{" "}
                    <span className="font-semibold text-[#0B1F3A]">
                      {dailyRateLabel}
                    </span>
                    {fleetLabel ? (
                      <span className="text-[#8A8278]">
                        {" "}
                        (Includes {fleetLabel})
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Daily rate calculated from your party size once rates are set."
                )}
              </p>
            </div>

            <div className="mb-4">
              <ExplainerTriggerButton
                featureKey="private_chauffeur"
                title="The Private Chauffeur Experience"
                contextId={cityId}
              />
            </div>

            {arrivalDateMissing ? (
              <p className="rounded-xl bg-[#F7F3EC] px-3 py-2.5 text-sm text-[#8A8278]">
                Set your arrival date in Step 1 to choose chauffeur days.
              </p>
            ) : dayOptions.length === 0 ? (
              <p className="rounded-xl bg-[#F7F3EC] px-3 py-2.5 text-sm text-[#8A8278]">
                No stay nights found for this city.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {dayOptions.map((day) => {
                  const sel = daySelections[day.date];
                  const mode: DriverMode = sel?.mode ?? "none";
                  const toursThatDay = toursOnDate(selectedTours, day.date);
                  return (
                    <li
                      key={day.date}
                      className="rounded-xl border border-[#EEE8DF] bg-[#FBF8F2] px-3 py-3"
                    >
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-[#0B1F3A]">
                          {day.label}
                        </p>
                        <div className="inline-flex rounded-full border border-[#D9D2C7] bg-white p-0.5">
                          {(
                            [
                              ["none", "Off"],
                              ["full_day", "By Day"],
                              ["by_tour", "By Tour"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => onSetDayMode(day.date, value)}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 ${
                                mode === value
                                  ? "bg-[#0B1F3A] text-white"
                                  : "text-[#5C6570] hover:text-[#0B1F3A]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {mode === "by_tour" ? (
                        toursThatDay.length === 0 ? (
                          <p className="mt-2 text-[11px] text-[#8A8278]">
                            No experiences scheduled on this day yet. Add one
                            and pick this date in Browse Experiences.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1.5 border-t border-[#EEE8DF] pt-2">
                            {toursThatDay.map((tour) => {
                              const checked = (
                                sel?.selectedTourIds ?? []
                              ).includes(tour.tourId);
                              return (
                                <li key={tour.tourId}>
                                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#0B1F3A]">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        onToggleDayTour(day.date, tour.tourId)
                                      }
                                      className="h-4 w-4 rounded border-[#D9D2C7] text-[#0B1F3A] focus:ring-[#C4A35A]"
                                    />
                                    <span className="min-w-0 truncate">
                                      {tour.title}
                                      {tour.duration_hours
                                        ? ` · ${tour.duration_hours}h`
                                        : ""}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )
                      ) : null}

                      {mode === "full_day" ? (
                        <p className="mt-2 text-[11px] text-[#8A8278]">
                          Full-day disposal — covers transfers and experiences
                          that day.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
