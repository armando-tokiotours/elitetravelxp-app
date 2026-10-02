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
import { HorizontalHelpAccordion } from "../HorizontalHelpAccordion";
import { FieldLabel } from "../ui";
import { CityTransportModal } from "./CityTransportModal";
import { GoldLight } from "@/components/branding/GoldLight";

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
      // Replace only the same tour on the same date; allow a second booking
      // of the same tourId on a different day after the duplicate confirm.
      const withoutSameSlot = current.filter(
        (t) =>
          !(
            t.tourId === tour.tourId &&
            t.scheduledDate === tour.scheduledDate
          )
      );
      const duration_hours = Number(tour.duration_hours) || 0;
      const check = canAddTourOnDate({
        selectedRows: withoutSameSlot,
        scheduledDate: tour.scheduledDate,
        newTourDurationHours: duration_hours,
      });
      if (!check.ok) return prev;
      ok = true;
      const nextRows = sortSelectedToursChronologically([
        ...withoutSameSlot,
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
      prev &&
      stayStops.some((l, index) => {
        const k = `stay-${index}-${l.key?.trim() || l.cityId || "city"}`;
        return k === prev;
      })
        ? prev
        : null
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tailored Experiences"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Tours &amp; Experiences
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
              <HorizontalHelpAccordion
                variant="alert"
                ariaLabelShow="Show tour day limits"
                ariaLabelHide="Hide tour day limits"
                text={
                  <>
                    Maximum {MAX_TOUR_HOURS_PER_DAY} hours of activities allowed
                    per day.{" "}
                    {allowToursOnTravelDays
                      ? `~${tourableDays} day${tourableDays === 1 ? "" : "s"} available.`
                      : `~${tourableDays} available day${
                          tourableDays === 1 ? "" : "s"
                        } after ${travelDays} travel day${
                          travelDays === 1 ? "" : "s"
                        }.`}
                  </>
                }
              />

              {seasonalMatches.length > 0 ? (
                <div className="space-y-2">
                  <FieldLabel>Concierge suggestions</FieldLabel>
                  {seasonalMatches.map((m, index) => (
                    <ConciergeSuggestionCard
                      key={`season-${index}-${m.highlight?.id || "h"}-${m.cityId || "c"}`}
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
                    {stayStops.map((stop, index) => {
                      const city = cityMap[stop.cityId];
                      const name =
                        cityNames[stop.cityId] ?? city?.name ?? "City";
                      const cityRows = selectedToursMap[stop.cityId] ?? [];
                      const citySelections =
                        chauffeurSelections[stop.cityId] ?? {};
                      const accordionKey = `stay-${index}-${
                        stop.key?.trim() || stop.cityId || "city"
                      }`;
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
                          key={accordionKey}
                          city={city}
                          cityName={name}
                          expanded={expandedKey === accordionKey}
                          onToggle={() =>
                            setExpandedKey((k) =>
                              k === accordionKey ? null : accordionKey
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
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d58]"
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
                const sameSlot = cityRows.some(
                  (t) =>
                    t.tourId === tour.id && t.scheduledDate === scheduledDate
                );
                const isDuplicate = cityRows.some((t) => t.tourId === tour.id);
                if (isDuplicate && !sameSlot) {
                  const confirmAdd = window.confirm(
                    `You have already selected "${tour.title}" for this city. Are you sure you want to book it twice?`
                  );
                  if (!confirmAdd) return { ok: false };
                }
                const check = canAddTourOnDate({
                  selectedRows: sameSlot
                    ? cityRows.filter(
                        (t) =>
                          !(
                            t.tourId === tour.id &&
                            t.scheduledDate === scheduledDate
                          )
                      )
                    : cityRows,
                  scheduledDate,
                  newTourDurationHours: duration_hours,
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
        key="tailored-quiz"
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
      <ActivityMatchReelModal
        key="tailored-reel"
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

/** e.g. "14 Oct" from YYYY-MM-DD; empty string if invalid. */
function formatStayDayDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

  const chauffeurDayLabels = useMemo(() => {
    return dayOptions
      .filter((d) => isBillableChauffeurDay(daySelections[d.date]))
      .map((d) => dayShortLabel(d.label));
  }, [dayOptions, daySelections]);

  const dayItineraryList = (
    <div className="h-full rounded-xl border border-white/5 bg-black/40 px-3 py-3">
      {dayOptions.length > 0 ? (
        <ul className="space-y-1">
          {dayOptions.map((day, index) => {
            const dateString = formatStayDayDate(day.date);
            const dayTours = selectedTours.filter(
              (t) => t.scheduledDate === day.date
            );
            const dayBit = dateString
              ? `${dateString} · Day ${index + 1}`
              : `Day ${index + 1}`;
            return (
              <li
                key={day.date || `day-${index}`}
                className="text-sm text-zinc-300"
              >
                <span className="inline-block w-28 shrink-0 text-zinc-500">
                  {dayBit}
                </span>
                <span className="ml-2 font-medium">
                  {dayTours.length > 0 ? (
                    dayTours
                      .map(
                        (t) =>
                          `${t.title}${
                            t.duration_hours
                              ? `, ${t.duration_hours}h`
                              : ""
                          }`
                      )
                      .join(" | ")
                  ) : (
                    <span className="italic text-zinc-500">Free day</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">
          {arrivalDateMissing
            ? "Set your arrival date to see day-by-day dates."
            : hideTransport
              ? `Tap City Experiences to add tours and tickets. Max ${MAX_TOUR_HOURS_PER_DAY}h of activities per day.`
              : `Tap a widget to add experiences or configure private transport. Max ${MAX_TOUR_HOURS_PER_DAY}h of activities per day.`}
        </p>
      )}
      {chauffeurDayLabels.length > 0 && !hideTransport ? (
        <p className="mt-2 text-xs text-zinc-400">
          {chauffeurDayLabels.join(", ")}: Private Chauffeur
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_2px_12px_rgba(11,31,58,0.04)]">
      <GoldLight color="#054F70" placement="right-center" active />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="relative z-10 flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
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
        <div className="relative z-10 border-t border-zinc-800 px-4 py-4">
          {hideTransport ? (
            <div className="mt-0 flex w-full flex-col items-stretch gap-4 sm:flex-row">
              <div className="w-full flex-shrink-0 sm:w-1/3">
                <button
                  type="button"
                  onClick={onBrowse}
                  className="h-full w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:bg-zinc-800"
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
              </div>
              <div className="w-full flex-grow sm:w-2/3">
                {dayItineraryList}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
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
                    {driverDayCount} Driver Day
                    {driverDayCount === 1 ? "" : "s"}
                  </p>
                </button>
              </div>
              {dayItineraryList}
            </>
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
