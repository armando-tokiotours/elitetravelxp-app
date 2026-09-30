"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { SeasonalityCard } from "@/components/builder/SeasonalityCard";
import { SeasonalityDetailModal } from "@/components/builder/modals/SeasonalityDetailModal";
import { DatePickerField } from "@/components/ui/CalendarModal";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { parseItineraryData } from "@/lib/preEliteBuilder";
import {
  TOUR_HOUR_PRESETS,
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
  type TourDurationHours,
} from "@/store/useSingleDayBuilderStore";
import type { SeasonTierName } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

/**
 * Builder S hours + tour date only (guests/pace live in SingleDayGuestsEditorModal).
 */
export function SingleDayTripDetailModal({
  open,
  onClose,
  seasonTiers = [],
}: {
  open: boolean;
  onClose: () => void;
  seasonTiers?: PbSeasonTier[];
}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const tourHoursCustom = useSingleDayBuilderStore((s) => s.tourHoursCustom);
  const setTourDate = useSingleDayBuilderStore((s) => s.setTourDate);
  const setTourHours = useSingleDayBuilderStore((s) => s.setTourHours);
  const setTourHoursCustom = useSingleDayBuilderStore(
    (s) => s.setTourHoursCustom
  );

  const [mounted, setMounted] = useState(false);
  const [customDraft, setCustomDraft] = useState(String(tourHours));
  const [seasonTier, setSeasonTier] = useState<SeasonTierName | null>(null);
  const [seasonCrowds, setSeasonCrowds] = useState<string | null>(null);
  const [seasonNote, setSeasonNote] = useState<string | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

  useModalDismiss(open, onClose);

  const canDone = Boolean(tourDate) && tourHours >= 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCustomDraft(String(tourHours));

    const pre = usePreBuilderStore.getState();
    const brief = pre.lastPayload?.itineraryData
      ? parseItineraryData(pre.lastPayload.itineraryData)
      : null;
    if (brief) {
      const sd = useSingleDayBuilderStore.getState();
      const start =
        brief.timing?.startDate ||
        (brief.dates && /^\d{4}-\d{2}-\d{2}/.test(brief.dates)
          ? brief.dates.slice(0, 10)
          : null);
      if (!sd.tourDate && start) {
        useSingleDayBuilderStore.setState({ tourDate: start });
      }
    }
  }, [open, tourHours]);

  useEffect(() => {
    if (!tourDate) {
      setSeasonTier(null);
      setSeasonCrowds(null);
      setSeasonNote(null);
      return;
    }
    const insight = resolveSeasonInsight(seasonTiers, tourDate);
    if (!insight) {
      setSeasonTier(null);
      setSeasonCrowds(null);
      setSeasonNote(null);
      return;
    }
    setSeasonTier(insight.tier);
    setSeasonCrowds(insight.crowd_level);
    setSeasonNote(insight.concierge_note);
  }, [tourDate, seasonTiers]);

  const selectPreset = (h: TourDurationHours) => {
    setTourHoursCustom(false);
    setTourHours(h);
    setCustomDraft(String(h));
  };

  const selectCustom = () => {
    setTourHoursCustom(true);
    setCustomDraft(String(tourHours));
  };

  const applyCustom = (raw: string) => {
    setCustomDraft(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 16) {
      setTourHours(parsed);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="single-hours-date"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Tour hours and date"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="tokio-modal-content relative z-[1] flex max-h-[min(90dvh,40rem)] w-full flex-col overflow-hidden border border-white/10 bg-[#0D1117] sm:max-w-lg sm:rounded-3xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <div className="tokio-modal-chrome flex shrink-0 items-center gap-3 border-b px-4 py-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1BA58A]">
                  Builder Single Day
                </p>
                <h3 className="truncate font-godiva text-xl uppercase tracking-wider text-white sm:text-2xl">
                  Hours &amp; Date
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="min-h-0 space-y-5 overflow-y-auto px-4 py-4 pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                  Tour Duration (Hours)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TOUR_HOUR_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => selectPreset(h)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                        !tourHoursCustom && tourHours === h
                          ? "bg-[#075473] text-white"
                          : "border border-white/15 bg-[#0D1117]/70 text-white/70 backdrop-blur-md hover:border-white/30"
                      }`}
                    >
                      {h} Hours
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={selectCustom}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      tourHoursCustom
                        ? "bg-[#075473] text-white"
                        : "border border-white/15 bg-[#0D1117]/70 text-white/70 backdrop-blur-md hover:border-white/30"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {tourHoursCustom ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-[#0D1117]/70 p-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                      Enter hours
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={16}
                        step={1}
                        inputMode="numeric"
                        value={customDraft}
                        onChange={(e) => applyCustom(e.target.value)}
                        onBlur={() => {
                          const parsed = Number.parseInt(customDraft, 10);
                          const next =
                            Number.isFinite(parsed) && parsed >= 1 ? parsed : 6;
                          setTourHours(next);
                          setCustomDraft(String(next));
                        }}
                        className="w-28 rounded-xl border border-white/15 bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473]"
                      />
                      <span className="text-xs text-white/45">
                        1–16 hours · no overnight stay
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
                <DatePickerField
                  value={tourDate}
                  onChange={(next) => {
                    setTourDate(next);
                    if (next) {
                      useSeasonalFxStore.getState().triggerFromDate(next);
                    }
                  }}
                  label="Tour date"
                  title="CHOOSE TOUR DATE"
                />

                <SeasonalityCard
                  arrivalDate={tourDate}
                  tier={seasonTier}
                  crowds={seasonCrowds}
                  note={seasonNote}
                  onOpenExplain={() => {
                    if (seasonTier && seasonNote) {
                      setSeasonModalOpen(true);
                    }
                  }}
                />
              </div>

              {tourDate ? (
                <p className="text-xs text-white/55">
                  {tourHours}h on{" "}
                  <span className="font-semibold text-white">
                    {formatSingleDayDisplayDate(tourDate)}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                disabled={!canDone}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </motion.div>

          <SeasonalityDetailModal
            open={seasonModalOpen}
            onClose={() => setSeasonModalOpen(false)}
            tier={seasonTier}
            crowds={seasonCrowds ?? ""}
            note={seasonNote ?? ""}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
