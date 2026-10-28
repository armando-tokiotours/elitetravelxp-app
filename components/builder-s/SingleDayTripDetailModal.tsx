"use client";

import { useEffect, useState } from "react";
import { BuilderEditModalShell } from "@/components/builder/modals/BuilderEditModalShell";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { SeasonalityCard } from "@/components/builder/SeasonalityCard";
import { SeasonalityDetailModal } from "@/components/builder/modals/SeasonalityDetailModal";
import { DatePickerField } from "@/components/ui/CalendarModal";
import { parseItineraryData } from "@/lib/preEliteBuilder";
import {
  TOUR_HOURS_CUSTOM_MAX,
  TOUR_HOURS_CUSTOM_MIN,
  clampCustomTourHours,
} from "@/lib/tourHoursTier";
import {
  TOUR_HOUR_PRESETS,
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
  type TourDurationHours,
} from "@/store/useSingleDayBuilderStore";
import type { SeasonTierName } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { AlarmClockPicker } from "@/components/ui/AlarmClockPicker";

/**
 * Builder S hours + tour date + start time (guests/pace live in SingleDayGuestsEditorModal).
 */
export function SingleDayTripDetailModal({
  open,
  onClose,
  onConfirmed,
  seasonTiers = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Fired when Done succeeds — advances guided pulsar to guests. */
  onConfirmed?: () => void;
  seasonTiers?: PbSeasonTier[];
}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const tourHoursCustom = useSingleDayBuilderStore((s) => s.tourHoursCustom);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const setTourDate = useSingleDayBuilderStore((s) => s.setTourDate);
  const setTourHours = useSingleDayBuilderStore((s) => s.setTourHours);
  const setTourHoursCustom = useSingleDayBuilderStore(
    (s) => s.setTourHoursCustom
  );
  const setStartTime = useSingleDayBuilderStore((s) => s.setStartTime);

  const [mounted, setMounted] = useState(false);
  const [activeSeasonTier, setActiveSeasonTier] =
    useState<SeasonTierName | null>(null);
  const [activeSeasonCrowds, setActiveSeasonCrowds] = useState<string | null>(
    null
  );
  const [activeSeasonNote, setActiveSeasonNote] = useState<string | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [doneClickCount, setDoneClickCount] = useState(0);

  const hoursOk = tourHours >= TOUR_HOURS_CUSTOM_MIN;
  const canSucceed = Boolean(tourDate) && hoursOk;
  const showPickDateHint = doneClickCount >= 1 && !tourDate;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDoneClickCount(0);
      return;
    }

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
  }, [open]);

  useEffect(() => {
    if (tourDate) setDoneClickCount(0);
  }, [tourDate]);

  useEffect(() => {
    if (!tourDate) {
      setActiveSeasonTier(null);
      setActiveSeasonCrowds(null);
      setActiveSeasonNote(null);
      return;
    }
    const insight = resolveSeasonInsight(seasonTiers, tourDate);
    if (!insight) {
      setActiveSeasonTier(null);
      setActiveSeasonCrowds(null);
      setActiveSeasonNote(null);
      return;
    }
    setActiveSeasonTier(insight.tier);
    setActiveSeasonCrowds(insight.crowd_level);
    setActiveSeasonNote(insight.concierge_note);
  }, [tourDate, seasonTiers]);

  const selectPreset = (h: TourDurationHours) => {
    setTourHoursCustom(false);
    setTourHours(h);
  };

  const selectCustom = () => {
    setTourHoursCustom(true);
    setTourHours(clampCustomTourHours(tourHours));
  };

  const bumpCustom = (delta: number) => {
    setTourHours(clampCustomTourHours(tourHours + delta));
  };

  return (
    <>
      <BuilderEditModalShell
        open={open}
        onClose={onClose}
        title="Hours & Date"
        mounted={mounted}
        variant="fullPage"
        footer={
          <button
            type="button"
            onClick={() => {
              if (!tourDate) {
                setDoneClickCount((c) => c + 1);
                return;
              }
              if (!hoursOk) return;
              onConfirmed?.();
              onClose();
            }}
            disabled={Boolean(tourDate) && !hoursOk}
            aria-disabled={!canSucceed}
            className={`w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40 ${
              !canSucceed && hoursOk ? "opacity-40" : ""
            }`}
          >
            Done →
          </button>
        }
      >
        <div className="box-border w-full max-w-full space-y-8 overflow-x-hidden">
          <section className="box-border w-full max-w-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#054F70]">
              Tour Duration (Hours)
            </p>
            <div className="mt-3 flex w-full flex-wrap gap-2">
              {TOUR_HOUR_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectPreset(h)}
                  className={`box-border min-w-0 shrink rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    !tourHoursCustom && tourHours === h
                      ? "border border-[#0080A3] bg-[#0D141C] text-white"
                      : "border border-transparent bg-[#0D141C] text-white/70 hover:border-white/20"
                  }`}
                >
                  {h} Hours
                </button>
              ))}
              <button
                type="button"
                onClick={selectCustom}
                className={`box-border min-w-0 shrink rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  tourHoursCustom
                    ? "border border-[#0080A3] bg-[#0D141C] text-white"
                    : "border border-transparent bg-[#0D141C] text-white/70 hover:border-white/20"
                }`}
              >
                Custom
              </button>
            </div>
            {tourHoursCustom ? (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                  Custom hours
                </p>
                <div className="flex h-11 w-28 items-stretch overflow-hidden rounded-xl border border-white/15 bg-[#121212]">
                  <span
                    className="flex min-w-0 flex-1 items-center justify-center text-base font-semibold tabular-nums text-white"
                    aria-live="polite"
                  >
                    {tourHours}
                  </span>
                  <div className="flex w-9 shrink-0 flex-col border-l border-white/15">
                    <button
                      type="button"
                      onClick={() => bumpCustom(1)}
                      disabled={tourHours >= TOUR_HOURS_CUSTOM_MAX}
                      className="flex flex-1 items-center justify-center text-[10px] leading-none text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Increase hours"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => bumpCustom(-1)}
                      disabled={tourHours <= TOUR_HOURS_CUSTOM_MIN}
                      className="flex flex-1 items-center justify-center border-t border-white/15 text-[10px] leading-none text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Decrease hours"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="box-border flex w-full max-w-full flex-col gap-4">
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
              labelClassName="text-[13px] font-medium uppercase tracking-[0.14em] text-[#0A1017]"
              bare
            />

            <SeasonalityCard
              arrivalDate={tourDate}
              tier={activeSeasonTier}
              crowds={activeSeasonCrowds}
              note={activeSeasonNote}
              showPickDateHint={showPickDateHint}
              onOpenExplain={() => {
                if (activeSeasonTier && activeSeasonNote) {
                  setSeasonModalOpen(true);
                }
              }}
            />

            <AlarmClockPicker
              value={startTime || "09:00"}
              onChange={setStartTime}
              label="Tour start time"
              bare
            />
          </section>

          {tourDate ? (
            <p className="text-xs text-[#64748b]">
              {tourHours}h starting {startTime || "09:00"} on{" "}
              <span className="font-semibold text-[#0A1017]">
                {formatSingleDayDisplayDate(tourDate)}
              </span>
            </p>
          ) : null}
        </div>
      </BuilderEditModalShell>

      <SeasonalityDetailModal
        open={seasonModalOpen}
        onClose={() => setSeasonModalOpen(false)}
        tier={activeSeasonTier}
        crowds={activeSeasonCrowds ?? ""}
        note={activeSeasonNote ?? ""}
      />
    </>
  );
}
