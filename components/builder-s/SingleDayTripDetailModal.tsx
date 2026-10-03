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
  const [customDraft, setCustomDraft] = useState(String(tourHours));
  const [activeSeasonTier, setActiveSeasonTier] =
    useState<SeasonTierName | null>(null);
  const [activeSeasonCrowds, setActiveSeasonCrowds] = useState<string | null>(
    null
  );
  const [activeSeasonNote, setActiveSeasonNote] = useState<string | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

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

  return (
    <>
      <BuilderEditModalShell
        open={open}
        onClose={onClose}
        title="Hours & Date"
        mounted={mounted}
        footer={
          <button
            type="button"
            onClick={() => {
              if (!canDone) return;
              onConfirmed?.();
              onClose();
            }}
            disabled={!canDone}
            className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Done
          </button>
        }
      >
        <div className="space-y-5">
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
              labelClassName="text-[14px] font-medium uppercase tracking-[0.14em] text-white"
            />

            <SeasonalityCard
              arrivalDate={tourDate}
              tier={activeSeasonTier}
              crowds={activeSeasonCrowds}
              note={activeSeasonNote}
              onOpenExplain={() => {
                if (activeSeasonTier && activeSeasonNote) {
                  setSeasonModalOpen(true);
                }
              }}
            />
          </div>

          <AlarmClockPicker
            value={startTime || "09:00"}
            onChange={setStartTime}
            label="Tour start time"
          />

          {tourDate ? (
            <p className="text-xs text-white/55">
              {tourHours}h starting {startTime || "09:00"} on{" "}
              <span className="font-semibold text-white">
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
