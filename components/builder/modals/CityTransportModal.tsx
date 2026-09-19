"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Car, Play, TrainFront } from "lucide-react";
import type { ChauffeurDayOption } from "@/lib/dateCascade";
import {
  isBillableChauffeurDay,
  type DailyChauffeurSelection,
  type DriverMode,
} from "@/lib/chauffeurSelections";
import type { SelectedTour } from "@/lib/selectedTours";
import { ExplainerModal } from "../ExplainerModal";

export function CityTransportModal({
  open,
  onClose,
  cityName,
  cityId,
  dayOptions,
  daySelections,
  selectedTours: _selectedTours,
  dailyRateLabel,
  fleetLabel,
  arrivalDateMissing,
  onSetDayMode,
  onToggleDayTour: _onToggleDayTour,
}: {
  open: boolean;
  onClose: () => void;
  cityName: string;
  cityId: string;
  dayOptions: ChauffeurDayOption[];
  daySelections: Record<string, DailyChauffeurSelection>;
  selectedTours: SelectedTour[];
  dailyRateLabel: string | null;
  fleetLabel: string | null;
  arrivalDateMissing: boolean;
  onSetDayMode: (date: string, mode: DriverMode) => void;
  onToggleDayTour: (date: string, tourId: string) => void;
}) {
  void _selectedTours;
  void _onToggleDayTour;

  const [mounted, setMounted] = useState(false);
  const [explainerType, setExplainerType] = useState<
    "public" | "private" | null
  >(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setExplainerType(null);
      return;
    }
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const driverDayCount = Object.values(daySelections).filter((sel) =>
    isBillableChauffeurDay(sel)
  ).length;

  const explainerKey =
    explainerType === "public"
      ? "public_transport"
      : explainerType === "private"
        ? "private_chauffeur"
        : undefined;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key={`city-transport-${cityId}`}
          className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0a]"
          role="dialog"
          aria-modal="true"
          aria-label={`${cityName} transport`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex flex-shrink-0 items-center gap-4 border-b border-zinc-800 bg-[#0a0a0a] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B85304]">
                  {cityName}
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  City Transport
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 pb-12">
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B85304]">
                  How will you move?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExplainerType("public")}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <TrainFront className="h-4 w-4" aria-hidden />
                    </span>
                    <h4 className="mt-3 text-sm font-bold text-white">
                      Public Transport
                    </h4>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-400">
                      Complex subway systems, walking between stations — best
                      for light travel days.
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B85304]">
                      <Play className="h-3 w-3" aria-hidden />
                      Watch explainer
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExplainerType("private")}
                    className="rounded-2xl border border-[#B85304]/40 bg-zinc-900 p-4 text-left transition hover:border-[#B85304] hover:bg-zinc-800"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B85304]/15 text-[#B85304]">
                      <Car className="h-4 w-4" aria-hidden />
                    </span>
                    <h4 className="mt-3 text-sm font-bold text-white">
                      Private Chauffeur
                    </h4>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-400">
                      Door-to-door luxury with luggage handled and direct
                      point-to-point service.
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B85304]">
                      <Play className="h-3 w-3" aria-hidden />
                      Watch explainer
                    </p>
                  </button>
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B85304]">
                    Day-by-day transport
                  </h4>
                  <p className="mt-1 text-sm text-zinc-400">
                    Defaults to public transport. Switch any day to a private
                    chauffeur.
                    {dailyRateLabel ? (
                      <>
                        {" "}
                        Private daily rate:{" "}
                        <span className="font-semibold text-white">
                          {dailyRateLabel}
                        </span>
                        {fleetLabel ? (
                          <span className="text-zinc-400">
                            {" "}
                            (Includes {fleetLabel})
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                </div>

                {arrivalDateMissing ? (
                  <p className="rounded-xl bg-zinc-950 px-3 py-2.5 text-sm text-zinc-400">
                    Set your arrival date in Step 1 to choose transport days.
                  </p>
                ) : dayOptions.length === 0 ? (
                  <p className="rounded-xl bg-zinc-950 px-3 py-2.5 text-sm text-zinc-400">
                    No stay nights found for this city.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {dayOptions.map((day) => {
                      const sel = daySelections[day.date];
                      const mode: DriverMode = sel?.mode ?? "none";
                      const isPrivate =
                        mode === "full_day" || mode === "by_tour";
                      return (
                        <li
                          key={day.date}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3"
                        >
                          <p className="mb-2.5 text-sm font-medium text-white">
                            {day.label}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 p-0.5">
                            <button
                              type="button"
                              onClick={() => onSetDayMode(day.date, "none")}
                              aria-pressed={!isPrivate}
                              className={`rounded-full px-2 py-2 text-center text-[11px] font-semibold leading-tight transition sm:px-3 ${
                                !isPrivate
                                  ? "bg-[#0B1F3A] text-white"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              Public Transport
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onSetDayMode(day.date, "full_day")
                              }
                              aria-pressed={isPrivate}
                              className={`rounded-full px-2 py-2 text-center text-[11px] font-semibold leading-tight transition sm:px-3 ${
                                isPrivate
                                  ? "bg-[#0B1F3A] text-white"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              Private Chauffeur
                            </button>
                          </div>
                          {isPrivate ? (
                            <p className="mt-2 text-[11px] text-zinc-400">
                              Full-day disposal — covers transfers and
                              experiences that day.
                            </p>
                          ) : (
                            <p className="mt-2 text-[11px] text-zinc-500">
                              Using public rail and subway for this day.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-2 border-t border-zinc-800 bg-[#0a0a0a]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <p className="text-center text-xs text-zinc-500">
                {driverDayCount === 0
                  ? "All days on public transport"
                  : `${driverDayCount} private chauffeur day${
                      driverDayCount === 1 ? "" : "s"
                    }`}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052]"
              >
                Save Transport
              </button>
            </div>
          </motion.div>

          <ExplainerModal
            open={explainerType !== null}
            onClose={() => setExplainerType(null)}
            featureKey={explainerKey}
            hubId={cityId}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
