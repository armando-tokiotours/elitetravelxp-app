"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock3, Minus, Plus } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { SeasonalityCard } from "@/components/builder/SeasonalityCard";
import { DatePickerField } from "@/components/ui/CalendarModal";
import {
  addDaysIso,
  formatDisplayDate,
  useBuilderStore,
} from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel } from "../ui";
import { SeasonalityDetailModal } from "@/components/builder/modals/SeasonalityDetailModal";
import { HorizontalHelpAccordion } from "@/components/builder/HorizontalHelpAccordion";

const PRESETS = [10, 14, 21] as const;
const MIN_DAYS = 1;
const MAX_DAYS = 45;

/**
 * Calendar / clock–oriented configure surface for trip length + arrival date.
 * Pace + guests live in DurationEditorModal (“Configure Trip Details”).
 */
export function DaysDateEditorModal({
  open,
  onClose,
  seasonTiers = [],
}: {
  open: boolean;
  onClose: () => void;
  seasonTiers?: PbSeasonTier[];
}) {
  const durationDays = useBuilderStore((s) => s.durationDays);
  const durationCustom = useBuilderStore((s) => s.durationCustom);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const activeSeasonTier = useBuilderStore((s) => s.activeSeasonTier);
  const activeSeasonNote = useBuilderStore((s) => s.activeSeasonNote);
  const setDurationDays = useBuilderStore((s) => s.setDurationDays);
  const setDurationCustom = useBuilderStore((s) => s.setDurationCustom);
  const setArrivalDate = useBuilderStore((s) => s.setArrivalDate);
  const setActiveSeason = useBuilderStore((s) => s.setActiveSeason);

  const [mounted, setMounted] = useState(false);
  const [customDraft, setCustomDraft] = useState(String(durationDays));
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

  const canDone = durationDays > 0 && Boolean(arrivalDate);
  const nights = Math.max(0, durationDays - 1);
  const departureIso =
    arrivalDate && durationDays >= 1
      ? addDaysIso(arrivalDate, durationDays)
      : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (durationCustom) setCustomDraft(String(durationDays));
  }, [durationCustom, durationDays]);

  useEffect(() => {
    const insight = resolveSeasonInsight(seasonTiers, arrivalDate);
    if (!insight) {
      setActiveSeason(null, null);
      return;
    }
    setActiveSeason(insight.tier, {
      crowds: insight.crowd_level,
      note: insight.concierge_note,
    });
  }, [arrivalDate, seasonTiers, setActiveSeason]);

  const selectPreset = (days: number) => {
    setDurationCustom(false);
    setDurationDays(days);
  };

  const selectCustom = () => {
    setDurationCustom(true);
    const n = Math.max(1, durationDays || 1);
    setDurationDays(n);
    setCustomDraft(String(n));
  };

  const applyCustom = (raw: string) => {
    setCustomDraft(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setDurationDays(Math.min(MAX_DAYS, parsed));
    }
  };

  const commitCustom = () => {
    const parsed = Number.parseInt(customDraft, 10);
    const next =
      Number.isFinite(parsed) && parsed >= 1
        ? Math.min(MAX_DAYS, parsed)
        : 1;
    setDurationDays(next);
    setCustomDraft(String(next));
  };

  const bumpDays = (delta: number) => {
    setDurationCustom(true);
    const next = Math.min(
      MAX_DAYS,
      Math.max(MIN_DAYS, (durationDays || 1) + delta)
    );
    setDurationDays(next);
    setCustomDraft(String(next));
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
          key="days-date-editor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Configure days and dates"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Trip Duration
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-4 pb-12">
              <div>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                  <Clock3 className="h-3.5 w-3.5 text-[#075473]" aria-hidden />
                  How many total days in Japan?
                </p>
                <HorizontalHelpAccordion
                  className="mb-2"
                  ariaLabelShow="Show how total days work"
                  ariaLabelHide="Hide total days help"
                  text="Set the full trip length first — then distribute nights across cities in Locations."
                />

                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-label="Fewer days"
                      disabled={durationDays <= MIN_DAYS}
                      onClick={() => bumpDays(-1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/5 disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <p className="min-w-[6rem] text-center font-display text-2xl text-white">
                      {Math.max(1, durationDays)}{" "}
                      <span className="text-base text-zinc-400">
                        {durationDays === 1 ? "Day" : "Days"}
                      </span>
                    </p>
                    <button
                      type="button"
                      aria-label="More days"
                      disabled={durationDays >= MAX_DAYS}
                      onClick={() => bumpDays(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/5 disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-zinc-500">
                    {nights} night{nights === 1 ? "" : "s"} on the ground
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESETS.map((days) => (
                    <ChoicePill
                      key={days}
                      size="sm"
                      active={!durationCustom && durationDays === days}
                      onClick={() => selectPreset(days)}
                    >
                      {days}
                    </ChoicePill>
                  ))}
                  <ChoicePill
                    size="sm"
                    active={durationCustom}
                    onClick={selectCustom}
                  >
                    Custom
                  </ChoicePill>
                </div>

                {durationCustom ? (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <FieldLabel>Enter days</FieldLabel>
                    <div className="mt-1 flex items-center gap-3">
                      <input
                        type="number"
                        min={MIN_DAYS}
                        max={MAX_DAYS}
                        step={1}
                        inputMode="numeric"
                        value={customDraft}
                        onChange={(e) => applyCustom(e.target.value)}
                        onBlur={commitCustom}
                        placeholder="e.g. 7, 12, 18"
                        className="w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473]"
                      />
                      <span className="text-sm text-zinc-400">
                        Min {MIN_DAYS} · max {MAX_DAYS} · Locations nights must
                        total{" "}
                        <strong className="text-white">
                          {Math.max(1, durationDays)}
                        </strong>
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative z-[1] overflow-visible md:grid md:grid-cols-2 md:gap-4">
                <div className="flex flex-col gap-4 md:contents">
                  <DatePickerField
                    value={arrivalDate}
                    onChange={(next) => {
                      setArrivalDate(next);
                      if (next) {
                        useSeasonalFxStore.getState().triggerFromDate(next);
                      }
                    }}
                    label="Arrival date"
                  />

                  <SeasonalityCard
                    arrivalDate={arrivalDate}
                    tier={activeSeasonTier}
                    crowds={activeSeasonNote?.crowds}
                    note={activeSeasonNote?.note}
                    onOpenExplain={() => {
                      if (activeSeasonTier && activeSeasonNote) {
                        setSeasonModalOpen(true);
                      }
                    }}
                  />
                </div>
              </div>

              {arrivalDate && departureIso ? (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-400">
                  Arrival:{" "}
                  <span className="text-white/85">
                    {formatDisplayDate(arrivalDate)}
                  </span>
                  <span className="mx-1.5 text-[#075473]">→</span>
                  Inferred departure:{" "}
                  <span className="text-white/85">
                    {formatDisplayDate(departureIso)}
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    ({Math.max(1, durationDays)}{" "}
                    {durationDays === 1 ? "day" : "days"})
                  </span>
                </p>
              ) : null}
            </div>

            <div className="tokio-modal-chrome flex flex-shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
            tier={activeSeasonTier}
            crowds={activeSeasonNote?.crowds ?? ""}
            note={activeSeasonNote?.note ?? ""}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
