"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Car, Sparkles, Ticket } from "lucide-react";
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
import type { SelectedTour, SelectedToursByCity } from "@/lib/selectedTours";
import {
  selectedTourIdsByCity,
  selectedTourIdsFromMap,
  sortSelectedToursChronologically,
} from "@/lib/selectedTours";
import {
  canAddTourOnDate,
  MAX_TOUR_HOURS_PER_DAY,
  TOUR_DAY_PACKED_MESSAGE,
} from "@/lib/tourValidator";
import { tourLanguageChoices } from "@/lib/tourLanguages";
import {
  matchSeasonalHighlights,
  type SeasonalHighlight,
} from "@/lib/seasonalMatcher";
import {
  formatTransferPriceRange,
  priceFleetChauffeurDay,
} from "@/lib/vehicleAllocator";
import { recommendedToursForCity } from "@/lib/experienceProfiler";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import { TravelProfileBadge } from "@/components/quiz/TravelProfileBadge";
import { ActivityMatchReelModal } from "@/components/modals/ActivityMatchReelModal";
import { buildTripMatchReelSlides } from "@/lib/matchReel";
import { ConciergeSuggestionCard } from "../ConciergeSuggestionCard";
import { ExperiencesDrawer } from "../ExperiencesDrawer";
import { ActivityMatcherBanner } from "../ActivityMatcherBanner";
import { FieldLabel } from "../ui";
import { CityTransportModal } from "./CityTransportModal";

export function TailoredExperiencesModal({
  open,
  onClose,
  tours,
  cities = [],
  cityNames,
  allowToursOnTravelDays = false,
  seasonalHighlights = [],
  vehicles = [],
  chauffeurRates = [],
  hideTransport = false,
}: {
  open: boolean;
  onClose: () => void;
  tours: PbTour[];
  cities?: PbCity[];
  cityNames: Record<string, string>;
  allowToursOnTravelDays?: boolean;
  seasonalHighlights?: SeasonalHighlight[];
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
  /** When true, only show experiences (drivers live in Builder Step 6). */
  hideTransport?: boolean;
}) {
  const router = useRouter();
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const committedTours = useBuilderStore((s) => s.selectedTours);
  const chauffeurSelections = useBuilderStore((s) => s.chauffeurSelections);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const setChauffeurDayMode = useBuilderStore((s) => s.setChauffeurDayMode);
  const toggleChauffeurDayTour = useBuilderStore(
    (s) => s.toggleChauffeurDayTour
  );
  const setExperienceService = useBuilderStore((s) => s.setExperienceService);
  const commitSelectedTours = useBuilderStore((s) => s.commitSelectedTours);
  const experienceProfile = useActiveMatchProfile();
  const durationDays = useBuilderStore((s) => s.durationDays);
  const totalPax = adults + children;

  const [mounted, setMounted] = useState(false);
  const [drawerCityId, setDrawerCityId] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [autoFillNote, setAutoFillNote] = useState<string | null>(null);
  /** Isolated draft — only commits to builder store on Done */
  const [draftTours, setDraftTours] = useState<SelectedToursByCity>({});

  useEffect(() => {
    if (!open) return;
    // Snapshot committed selections when the configure module opens
    const snapshot: SelectedToursByCity = {};
    for (const [cityId, rows] of Object.entries(committedTours ?? {})) {
      snapshot[cityId] = rows.map((r) => ({ ...r }));
    }
    setDraftTours(snapshot);
    setAutoFillNote(null);
    setDrawerCityId(null);
    setExpandedKey(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot once per open

  const selectedToursMap = draftTours;
  const selectedTourIds = useMemo(
    () => selectedTourIdsFromMap(draftTours),
    [draftTours]
  );
  const selectedToursByCity = useMemo(
    () => selectedTourIdsByCity(draftTours),
    [draftTours]
  );

  const draftAddCityTour = (
    cityId: string,
    tour: SelectedTour
  ): boolean => {
    if (!tour.scheduledDate) return false;
    if (!String(tour.selectedLanguage || "").trim()) return false;
    let ok = false;
    setDraftTours((prev) => {
      const current = prev[cityId] ?? [];
      const without = current.filter((t) => t.tourId !== tour.tourId);
      const duration_hours = Number(tour.duration_hours) || 0;
      const check = canAddTourOnDate({
        selectedRows: without,
        scheduledDate: tour.scheduledDate,
        newTourDurationHours: duration_hours,
        tourId: tour.tourId,
      });
      if (!check.ok) return prev;
      ok = true;
      const nextRows = sortSelectedToursChronologically([
        ...without,
        {
          tourId: tour.tourId,
          title: tour.title,
          duration_hours,
          scheduledDate: tour.scheduledDate,
          selectedLanguage: String(tour.selectedLanguage).trim(),
          price: Number(tour.price) || 0,
          ...(tour.languages?.length ? { languages: tour.languages } : {}),
          ...(tour.customDuration ? { customDuration: true } : {}),
        },
      ]);
      return { ...prev, [cityId]: nextRows };
    });
    return ok;
  };

  const draftRemoveCityTour = (cityId: string, tourId: string) => {
    setDraftTours((prev) => {
      const current = prev[cityId] ?? [];
      if (!current.some((t) => t.tourId === tourId)) return prev;
      const nextRows = current.filter((t) => t.tourId !== tourId);
      const next = { ...prev };
      if (nextRows.length === 0) delete next[cityId];
      else next[cityId] = nextRows;
      return next;
    });
  };

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
  );

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

  const nightsByCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const loc of stayStops) {
      map.set(loc.cityId, (map.get(loc.cityId) ?? 0) + loc.nights);
    }
    return map;
  }, [stayStops]);

  const reelSlides = useMemo(
    () =>
      buildTripMatchReelSlides({
        tours,
        cityNames,
        selectedTourIds,
        profile: experienceProfile,
        stayCityIds: Array.from(nightsByCity.keys()),
        limit: 10,
      }),
    [tours, cityNames, selectedTourIds, experienceProfile, nightsByCity]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setAutoFillNote(null);
      setQuizOpen(false);
      return;
    }
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (stayStops.length === 0) {
      setExpandedKey(null);
      return;
    }
    // Keep expansion only if the open key still exists — never auto-open a city
    setExpandedKey((prev) =>
      prev && stayStops.some((l) => l.key === prev) ? prev : null
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

  const tourCount = selectedTourIds.length;
  const chauffeurDayCount = countBillableChauffeurDays(chauffeurSelections);

  const handleDone = () => {
    commitSelectedTours(draftTours);
    setExperienceService("tailored");
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleAutoFillRecommended = () => {
    if (!experienceProfile) {
      setQuizOpen(true);
      return;
    }
    if (!arrivalDate) {
      setAutoFillNote("Set your arrival date in Step 1 before auto-filling.");
      return;
    }
    if (stayStops.length === 0) {
      setAutoFillNote("Add stay cities in Step 3 before auto-filling.");
      return;
    }

    let added = 0;
    let skipped = 0;
    const nextDraft: SelectedToursByCity = {};
    for (const [cityId, rows] of Object.entries(draftTours)) {
      nextDraft[cityId] = rows.map((r) => ({ ...r }));
    }

    const uniqueCities = Array.from(nightsByCity.entries());

    for (const [cityId, nights] of uniqueCities) {
      const picks = recommendedToursForCity(
        tours,
        cityId,
        nights,
        experienceProfile
      );
      const dayOptions = chauffeurDaysForCity(arrivalDate, locations, cityId);
      if (dayOptions.length === 0) {
        skipped += picks.length;
        continue;
      }

      let workingRows = [...(nextDraft[cityId] ?? [])];

      for (const tour of picks) {
        if (workingRows.some((r) => r.tourId === tour.id)) {
          skipped += 1;
          continue;
        }
        const duration_hours = Number(tour.duration_hours) || 0;
        const lang =
          tourLanguageChoices(tour.languages)[0]?.code || "EN";
        let placed = false;
        for (const day of dayOptions) {
          const check = canAddTourOnDate({
            selectedRows: workingRows,
            scheduledDate: day.date,
            newTourDurationHours: duration_hours,
            tourId: tour.id,
          });
          if (!check.ok) continue;
          const without = workingRows.filter((t) => t.tourId !== tour.id);
          workingRows = sortSelectedToursChronologically([
            ...without,
            {
              tourId: tour.id,
              title: tour.title,
              duration_hours,
              scheduledDate: day.date,
              selectedLanguage: lang,
              price: tourPrice(tour, { adults, children }),
              ...(tour.languages?.length
                ? { languages: tour.languages }
                : {}),
            },
          ]);
          nextDraft[cityId] = workingRows;
          added += 1;
          placed = true;
          break;
        }
        if (!placed) skipped += 1;
      }
    }

    setDraftTours(nextDraft);

    if (added === 0) {
      setAutoFillNote(
        skipped > 0
          ? "No new matches fit your schedule — browse city lists for ⭐ Recommended Match badges."
          : "No strong matches yet — retake the quiz or browse city lists."
      );
    } else {
      setAutoFillNote(
        `Added ${added} recommended experience${added === 1 ? "" : "s"}${
          skipped > 0 ? ` · ${skipped} already booked or full` : ""
        }.`
      );
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="tailored-experiences"
          className="fixed inset-0 z-50 flex items-center justify-center tokio-modal-backdrop bg-[#05080C]/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Tailored Experiences"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="tokio-modal-content relative flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 md:h-[85vh] md:max-w-2xl md:rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="tokio-modal-chrome flex flex-shrink-0 items-center gap-4 border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Cancel without saving"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D9718C]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Tailored Experiences
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-12">
              {/* 1. Your Travel Profile */}
              {experienceProfile ? (
                <TravelProfileBadge
                  onRetake={() => setQuizOpen(true)}
                  tone="dark"
                />
              ) : null}

              {/* 2. Your Cities */}
              <div className="rounded-xl bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                Maximum {MAX_TOUR_HOURS_PER_DAY} hours of activities allowed per
                day.{" "}
                {allowToursOnTravelDays
                  ? `~${tourableDays} day${tourableDays === 1 ? "" : "s"} available.`
                  : `~${tourableDays} available day${
                      tourableDays === 1 ? "" : "s"
                    } after ${travelDays} travel day${
                      travelDays === 1 ? "" : "s"
                    }.`}
              </div>

              {seasonalMatches.length > 0 ? (
                <div className="space-y-2">
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
                        if (!m.cityId) return;
                        const cityRows = selectedToursMap[m.cityId] ?? [];
                        const citySelected =
                          selectedToursByCity[m.cityId] ?? [];
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
                          newTourDurationHours:
                            Number(tour.duration_hours) || 0,
                          tourId: id,
                        });
                        if (!check.ok) return;
                        if (!citySelected.includes(id)) {
                          const lang =
                            tourLanguageChoices(tour.languages)[0]?.code ||
                            "EN";
                          draftAddCityTour(m.cityId, {
                            tourId: tour.id,
                            title: tour.title,
                            duration_hours: Number(tour.duration_hours) || 0,
                            scheduledDate: date,
                            selectedLanguage: lang,
                            price: tourPrice(tour, { adults, children }),
                            ...(tour.languages?.length
                              ? { languages: tour.languages }
                              : {}),
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              ) : null}

              <div>
                <FieldLabel>Your cities</FieldLabel>
                {stayStops.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                    Add stay cities in Step 3 to browse experiences
                    {hideTransport ? "." : " and book a private chauffeur by day."}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-3">
                    {stayStops.map((stop) => {
                      const city = cityMap[stop.cityId];
                      const name =
                        cityNames[stop.cityId] ?? city?.name ?? "City";
                      const cityRows = selectedToursMap[stop.cityId] ?? [];
                      const citySelections =
                        chauffeurSelections[stop.cityId] ?? {};
                      const driverDayCount = Object.values(
                        citySelections
                      ).filter((sel) => isBillableChauffeurDay(sel)).length;
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
                      const fleetLabel =
                        quote?.fleet?.label?.replace("×", "x") ?? null;

                      return (
                        <CityExperienceAccordion
                          key={stop.key || `stay-${stop.cityId}-${name}`}
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
                          hideTransport={hideTransport}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Activity Matcher */}
              <div className="space-y-3">
                <FieldLabel>Activity Matcher</FieldLabel>
                <ActivityMatcherBanner
                  showProfile={false}
                  onOpenQuiz={() => setQuizOpen(true)}
                  onWatch={() => setReelOpen(true)}
                  onDiscover={() => {
                    handleDone();
                    router.push("/discover");
                  }}
                />

                {experienceProfile ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleAutoFillRecommended}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#075473]/50 bg-[#075473]/15 px-3 py-2.5 text-[13px] font-semibold text-[#F3D9C4] transition hover:bg-[#075473]/25 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
                    >
                      <Sparkles
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        aria-hidden
                      />
                      Auto-Fill Recommended Activities
                    </button>
                    {autoFillNote ? (
                      <p
                        role="status"
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-xs text-zinc-400"
                      >
                        {autoFillNote}
                      </p>
                    ) : (
                      <p className="text-center text-[11px] text-zinc-500">
                        Gold ⭐ Recommended Match badges appear in Tokyo,
                        Kamakura, Kyoto &amp; other city lists.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="tokio-modal-chrome flex flex-shrink-0 flex-col gap-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="text-center text-xs text-zinc-500">
                {tourCount === 0
                  ? "No experiences yet"
                  : `${tourCount} experience${tourCount === 1 ? "" : "s"}`}
                {!hideTransport ? (
                  <>
                    {" · "}
                    {chauffeurDayCount === 0
                      ? "No chauffeur days"
                      : `${chauffeurDayCount} chauffeur day${
                          chauffeurDayCount === 1 ? "" : "s"
                        }`}
                  </>
                ) : null}
              </p>
              <button
                type="button"
                onClick={handleDone}
                className="w-full rounded-full bg-[#1CA67F] py-3 text-sm font-semibold text-white transition hover:bg-[#178f6d]"
              >
                Save &amp; Apply
              </button>
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
              guests={{ adults, children }}
              availableLanguages={
                drawerCityId
                  ? cityMap[drawerCityId]?.available_languages
                  : undefined
              }
              onRemoveTour={(tourId) => {
                if (!drawerCityId) return;
                draftRemoveCityTour(drawerCityId, tourId);
              }}
              onAddTour={(tour, scheduledDate, selectedLanguage) => {
                if (!drawerCityId) return { ok: false };
                if (!selectedLanguage.trim()) {
                  return {
                    ok: false,
                    message:
                      "Select a preferred language before adding this experience.",
                  };
                }
                const cityRows = selectedToursMap[drawerCityId] ?? [];
                const duration_hours = Number(tour.duration_hours) || 0;
                const check = canAddTourOnDate({
                  selectedRows: cityRows,
                  scheduledDate,
                  newTourDurationHours: duration_hours,
                  tourId: tour.id,
                });
                if (!check.ok) {
                  return {
                    ok: false,
                    message: check.message ?? TOUR_DAY_PACKED_MESSAGE,
                  };
                }
                const ok = draftAddCityTour(drawerCityId, {
                  tourId: tour.id,
                  title: tour.title,
                  duration_hours,
                  scheduledDate,
                  selectedLanguage: selectedLanguage.trim(),
                  price: tourPrice(tour, { adults, children }),
                  ...(tour.languages?.length
                    ? { languages: tour.languages }
                    : {}),
                });
                return {
                  ok,
                  message: ok ? undefined : TOUR_DAY_PACKED_MESSAGE,
                };
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
      <ActivityMatchReelModal
        open={reelOpen}
        onClose={() => setReelOpen(false)}
        slides={reelSlides}
        experienceProfile={experienceProfile}
      />
    </AnimatePresence>,
    document.body
  );
}

function dayShortLabel(label: string): string {
  const m = label.match(/^Day\s+\d+/i);
  return m ? m[0] : label;
}

function CityExperienceAccordion({
  city,
  cityName,
  expanded,
  onToggle,
  experienceCount,
  driverDayCount,
  selectedTours,
  dayOptions,
  onBrowse,
  dailyRateLabel,
  fleetLabel,
  daySelections,
  cityId,
  onSetDayMode,
  onToggleDayTour,
  arrivalDateMissing,
  hideTransport = false,
}: {
  city?: PbCity;
  cityName: string;
  expanded: boolean;
  onToggle: () => void;
  experienceCount: number;
  driverDayCount: number;
  selectedTours: SelectedTour[];
  dayOptions: ReturnType<typeof chauffeurDaysForCity>;
  onBrowse: () => void;
  dailyRateLabel: string | null;
  fleetLabel: string | null;
  daySelections: Record<string, DailyChauffeurSelection>;
  cityId: string;
  onSetDayMode: (date: string, mode: DriverMode) => void;
  onToggleDayTour: (date: string, tourId: string) => void;
  arrivalDateMissing: boolean;
  hideTransport?: boolean;
}) {
  const [transportOpen, setTransportOpen] = useState(false);

  const filename = city ? cityPhoto(city) : "";
  const img =
    filename && city
      ? pbFileUrl(city.collectionId, city.id, filename, "200x140")
      : "";

  const summaryBits = hideTransport
    ? `${experienceCount} Experience${experienceCount === 1 ? "" : "s"}`
    : [
        `${experienceCount} Experience${experienceCount === 1 ? "" : "s"}`,
        `${driverDayCount} Driver Day${driverDayCount === 1 ? "" : "s"}`,
      ].join(" · ");

  const orderedTours = useMemo(
    () => sortSelectedToursChronologically(selectedTours),
    [selectedTours]
  );

  const chauffeurDayLabels = useMemo(() => {
    return dayOptions
      .filter((d) => isBillableChauffeurDay(daySelections[d.date]))
      .map((d) => dayShortLabel(d.label));
  }, [dayOptions, daySelections]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_2px_12px_rgba(11,31,58,0.04)]">
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
          <span className="block truncate font-medium text-white">
            {cityName}
          </span>
          <span className="block truncate text-xs text-zinc-400">
            {summaryBits}
          </span>
        </span>
        <span
          className={`shrink-0 text-[#075473] transition ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-800 px-4 py-4">
          <div
            className={`mb-4 grid gap-3 ${
              hideTransport ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            <button
              type="button"
              onClick={onBrowse}
              className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:bg-zinc-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F29727]/15 text-[#F29727]">
                <Ticket className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-2 text-sm font-bold text-white md:text-base">
                City Experiences
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {experienceCount} selected
              </p>
            </button>

            {!hideTransport ? (
              <button
                type="button"
                onClick={() => setTransportOpen(true)}
                className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:bg-zinc-800"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                  <Car className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-2 text-sm font-bold text-white md:text-base">
                  City Transport
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {driverDayCount} Driver Day{driverDayCount === 1 ? "" : "s"}
                </p>
              </button>
            ) : null}
          </div>

          {orderedTours.length > 0 || chauffeurDayLabels.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3">
              {orderedTours.length > 0 ? (
                <ul className="space-y-1">
                  {orderedTours.map((tour) => {
                    const dayOpt = dayOptions.find(
                      (d) => d.date === tour.scheduledDate
                    );
                    const dayBit = dayOpt
                      ? dayShortLabel(dayOpt.label)
                      : "Day ?";
                    return (
                      <li
                        key={`${tour.tourId}-${tour.scheduledDate}`}
                        className="truncate text-xs text-zinc-300"
                      >
                        {dayBit} · {tour.title}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {chauffeurDayLabels.length > 0 && !hideTransport ? (
                <p className="text-xs text-zinc-400">
                  {chauffeurDayLabels.join(", ")}: Private Chauffeur
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {hideTransport
                ? `Tap City Experiences to add tours and tickets. Max ${MAX_TOUR_HOURS_PER_DAY}h of activities per day.`
                : `Tap a widget to add experiences or configure private transport. Max ${MAX_TOUR_HOURS_PER_DAY}h of activities per day.`}
            </p>
          )}
        </div>
      ) : null}

      {!hideTransport ? (
        <CityTransportModal
          open={transportOpen}
          onClose={() => setTransportOpen(false)}
          cityName={cityName}
          cityId={cityId}
          dayOptions={dayOptions}
          daySelections={daySelections}
          selectedTours={selectedTours}
          dailyRateLabel={dailyRateLabel}
          fleetLabel={fleetLabel}
          arrivalDateMissing={arrivalDateMissing}
          onSetDayMode={onSetDayMode}
          onToggleDayTour={onToggleDayTour}
        />
      ) : null}
    </div>
  );
}
