"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { PbTour } from "@/lib/pocketbase/client";
import type { ChauffeurDayOption } from "@/lib/dateCascade";
import type { SelectedTour } from "@/lib/selectedTours";
import {
  getAvailableHours,
  MAX_TOUR_HOURS_PER_DAY,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";
import { ScheduleTourDaySheet } from "./ScheduleTourDaySheet";
import { TourDetailPanel } from "./TourDetailPanel";
import {
  isBestMatchTour,
  rankToursByProfile,
} from "@/lib/experienceProfiler";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import { TravelProfileBadge } from "@/components/quiz/TravelProfileBadge";
import { ExperienceProfilerModal } from "@/components/quiz/ExperienceProfilerModal";
import { CityLanguageSelect } from "@/components/builder/CityLanguageSelect";

function tourCategory(tour: PbTour): "tour" | "activity" {
  const cat = String(tour.category || "tour").toLowerCase();
  return cat === "activity" ? "activity" : "tour";
}

export function ExperiencesDrawer({
  open,
  onClose,
  cityName,
  nights,
  tours,
  selectedTours,
  dayOptions,
  guests,
  availableLanguages,
  onAddTour,
  onRemoveTour,
}: {
  open: boolean;
  onClose: () => void;
  cityName: string;
  nights: number;
  tours: PbTour[];
  selectedTours: SelectedTour[];
  dayOptions: ChauffeurDayOption[];
  guests: { adults: number; children: number };
  availableLanguages?: unknown;
  onAddTour: (
    tour: PbTour,
    scheduledDate: string,
    selectedLanguage: string
  ) => { ok: boolean; message?: string };
  onRemoveTour: (tourId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pickingTourId, setPickingTourId] = useState<string | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState("");
  const [activeTab, setActiveTab] = useState<"tours" | "experiences">(
    "tours"
  );
  const [quizOpen, setQuizOpen] = useState(false);
  const preferredTourLanguage = useBuilderStore((s) => s.preferredTourLanguage);
  const setPreferredTourLanguage = useBuilderStore(
    (s) => s.setPreferredTourLanguage
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPickingTourId(null);
      setPendingLanguage("");
      setActiveTab("tours");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selectedById = useMemo(
    () => Object.fromEntries(selectedTours.map((t) => [t.tourId, t])),
    [selectedTours]
  );

  const experienceProfile = useActiveMatchProfile();

  const filteredTours = useMemo(() => {
    const list = tours.filter((t) => {
      const cat = tourCategory(t);
      return activeTab === "experiences"
        ? cat === "activity"
        : cat === "tour";
    });
    return rankToursByProfile(list, experienceProfile);
  }, [activeTab, tours, experienceProfile]);

  const pickingTour = pickingTourId
    ? tours.find((t) => t.id === pickingTourId) ?? null
    : null;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="tokio-modal-opaque fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${cityName} experiences`}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sticky top-0 z-20 shrink-0 border-b border-[#EEE8DF] bg-white px-4 pb-3 pt-6 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                    Browse
                  </p>
                  <h3 className="font-display text-2xl text-[#0B1F3A]">
                    {cityName}
                  </h3>
                  <p className="mt-1 text-xs text-[#8A8278]">
                    {nights} night{nights === 1 ? "" : "s"} · Max{" "}
                    {MAX_TOUR_HOURS_PER_DAY}h of activities per day
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm text-white"
                >
                  Done
                </button>
              </div>

              {experienceProfile ? (
                <div className="mt-3">
                  <TravelProfileBadge
                    onRetake={() => setQuizOpen(true)}
                    tone="light"
                  />
                </div>
              ) : null}

              <div
                role="tablist"
                aria-label="Filter by category"
                className="mt-4 grid grid-cols-2 gap-1 rounded-full border border-[#E5DFD4] bg-[#F7F3EB] p-1"
              >
                {(
                  [
                    ["tours", "Tours"],
                    ["experiences", "Experiences"],
                  ] as const
                ).map(([id, label]) => {
                  const selected = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(id)}
                      className={`rounded-full py-2 text-sm font-semibold transition ${
                        selected
                          ? "bg-[#0B1F3A] text-white shadow-sm"
                          : "text-[#5C6570] hover:text-[#0B1F3A]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {toast ? (
              <div
                role="status"
                className="mx-4 mt-3 rounded-xl border border-[#075473]/50 bg-[#FAF0E6] px-3.5 py-2.5 text-sm text-[#632502]"
              >
                ⚠️ {toast}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-[max(7rem,env(safe-area-inset-bottom))]">
              <CityLanguageSelect
                cityName={cityName}
                availableLanguages={availableLanguages}
                value={preferredTourLanguage}
                onChange={setPreferredTourLanguage}
              />
              {filteredTours.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#8A8278]">
                  {activeTab === "tours"
                    ? `No tours listed for ${cityName} yet.`
                    : `No experiences listed for ${cityName} yet.`}{" "}
                  Add them in Team Access and set Category to{" "}
                  {activeTab === "tours" ? "tour" : "activity"}.
                </p>
              ) : (
                filteredTours.map((tour) => {
                  const booked = selectedById[tour.id];
                  const recommended = isBestMatchTour(tour, experienceProfile);
                  return (
                    <TourDetailPanel
                      key={tour.id}
                      tour={tour}
                      guests={guests}
                      recommended={recommended}
                      scheduledLabel={
                        booked?.scheduledDate
                          ? dayOptions.find(
                              (d) => d.date === booked.scheduledDate
                            )?.label ?? booked.scheduledDate
                          : null
                      }
                      bookedLanguage={booked?.selectedLanguage || null}
                      defaultLanguage={preferredTourLanguage}
                      selected={Boolean(booked)}
                      onAdd={(lang) => {
                        if (booked) {
                          onRemoveTour(tour.id);
                          return;
                        }
                        const resolved =
                          lang || preferredTourLanguage || "EN";
                        if (!resolved) {
                          setToast(
                            "Select a preferred language before adding this experience."
                          );
                          return;
                        }
                        if (dayOptions.length === 0) {
                          setToast(
                            "Set your arrival date and city nights in Steps 1–3 before scheduling experiences."
                          );
                          return;
                        }
                        if (dayOptions.length === 1) {
                          const day = dayOptions[0];
                          const hours = tourDurationHours(tour);
                          const available = getAvailableHours(
                            selectedTours,
                            day.date
                          );
                          if (hours > available) {
                            setToast(TOUR_DAY_PACKED_MESSAGE);
                            return;
                          }
                          const result = onAddTour(tour, day.date, resolved);
                          if (!result.ok && result.message) {
                            setToast(result.message);
                          }
                          return;
                        }
                        setPendingLanguage(resolved);
                        setPickingTourId(tour.id);
                      }}
                    />
                  );
                })
              )}
            </div>

            <ScheduleTourDaySheet
              open={!!pickingTour && !!pendingLanguage}
              tour={pickingTour}
              cityName={cityName}
              dayOptions={dayOptions}
              selectedTours={selectedTours}
              onClose={() => {
                setPickingTourId(null);
                setPendingLanguage("");
              }}
              onSelectDay={(date) =>
                onAddTour(pickingTour!, date, pendingLanguage)
              }
              onToast={setToast}
            />
          </motion.div>
        </div>
      ) : null}
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
    </AnimatePresence>,
    document.body
  );
}
