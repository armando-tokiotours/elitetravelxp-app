"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Minus, Plus, X } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { SeasonalityCard } from "@/components/builder/SeasonalityCard";
import { PaceDetailModal } from "@/components/builder/modals/PaceDetailModal";
import { SeasonalityDetailModal } from "@/components/builder/modals/SeasonalityDetailModal";
import { DatePickerField } from "@/components/ui/CalendarModal";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { parseItineraryData } from "@/lib/preEliteBuilder";
import { experienceProfileFromBrief } from "@/lib/preEliteHydrate";
import { type PaceId } from "@/lib/travelPace";
import {
  TOUR_HOUR_PRESETS,
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
  type TourDurationHours,
} from "@/store/useSingleDayBuilderStore";
import type { SeasonTierName } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

/**
 * Builder S–only tour details modal.
 * Guests → hours → tour date → travel pace. Seeds from Pre-Build when empty.
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
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const tourHoursCustom = useSingleDayBuilderStore((s) => s.tourHoursCustom);
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const setTourDate = useSingleDayBuilderStore((s) => s.setTourDate);
  const setAdults = useSingleDayBuilderStore((s) => s.setAdults);
  const setChildren = useSingleDayBuilderStore((s) => s.setChildren);
  const setTourHours = useSingleDayBuilderStore((s) => s.setTourHours);
  const setTourHoursCustom = useSingleDayBuilderStore(
    (s) => s.setTourHoursCustom
  );
  const setTravelPace = useSingleDayBuilderStore((s) => s.setTravelPace);

  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getTravelPaces = useSiteBrandingStore((s) => s.getTravelPaces);
  const travelPaces = getTravelPaces();
  void brandingItems;

  const [mounted, setMounted] = useState(false);
  const [customDraft, setCustomDraft] = useState(String(tourHours));
  const [seasonTier, setSeasonTier] = useState<SeasonTierName | null>(null);
  const [seasonCrowds, setSeasonCrowds] = useState<string | null>(null);
  const [seasonNote, setSeasonNote] = useState<string | null>(null);
  const [paceModal, setPaceModal] = useState<PaceId | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

  useModalDismiss(open, onClose);

  const totalGuests = adults + children;
  const canDone =
    Boolean(tourDate) &&
    totalGuests > 0 &&
    tourHours >= 1 &&
    travelPace !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
    setCustomDraft(String(tourHours));

    const pre = usePreBuilderStore.getState();
    const brief = pre.lastPayload?.itineraryData
      ? parseItineraryData(pre.lastPayload.itineraryData)
      : null;
    if (brief) {
      const patch: Record<string, unknown> = {};
      const sd = useSingleDayBuilderStore.getState();
      const start =
        brief.timing?.startDate ||
        (brief.dates && /^\d{4}-\d{2}-\d{2}/.test(brief.dates)
          ? brief.dates.slice(0, 10)
          : null);
      if (!sd.tourDate && start) patch.tourDate = start;
      if (sd.adults === 2 && brief.groupSize.adults !== 2) {
        patch.adults = Math.max(1, brief.groupSize.adults);
      }
      if (sd.children === 0 && brief.groupSize.children > 0) {
        patch.children = brief.groupSize.children;
      }
      if (!sd.travelPace) {
        const profile = experienceProfileFromBrief(brief);
        patch.travelPace =
          profile.pace === "relaxed"
            ? "relaxed"
            : profile.pace === "active"
              ? "fast"
              : "moderate";
      }
      if (Object.keys(patch).length) {
        useSingleDayBuilderStore.setState(patch);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot hours on open
  }, [open, ensureBrandingLoaded]);

  useEffect(() => {
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

  const selectPreset = (hours: TourDurationHours) => {
    setTourHoursCustom(false);
    setTourHours(hours);
    setCustomDraft(String(hours));
  };

  const selectCustom = () => {
    setTourHoursCustom(true);
    const n = Math.max(1, tourHours || 6);
    setTourHours(n);
    setCustomDraft(String(n));
  };

  const applyCustom = (raw: string) => {
    setCustomDraft(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setTourHours(parsed);
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
          key="single-day-tour-detail"
          className="fixed inset-0 z-[110] flex items-end justify-center bg-[#05080C]/55 backdrop-blur-sm sm:items-center sm:p-2"
          role="dialog"
          aria-modal="true"
          aria-label="Configure tour details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex max-h-[min(96dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#05080C]/88 shadow-2xl backdrop-blur-3xl sm:rounded-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:border-white/30"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1BA58A]">
                  Builder Single Day
                </p>
                <h3 className="truncate font-godiva text-xl uppercase tracking-wider text-white sm:text-2xl">
                  Configure Tour Details
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

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                  Number of Guests
                </p>
                <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 backdrop-blur-md">
                  <GuestStepper
                    label="Adults"
                    value={adults}
                    onChange={setAdults}
                    min={1}
                  />
                  <GuestStepper
                    label="Kids"
                    value={children}
                    onChange={setChildren}
                    min={0}
                  />
                </div>
              </div>

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

              <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-3">
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

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
                  Travel Pace
                </p>
                <p className="mb-3 mt-1 text-xs text-white/45">
                  Tap a style to learn more, then confirm your preferred rhythm.
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {travelPaces.map((pace) => {
                    const isSelected = travelPace === pace.id;
                    const hasSelection = travelPace !== null;
                    const cardClass = isSelected
                      ? "border-2 border-[#075473] opacity-100 scale-100 z-10"
                      : hasSelection
                        ? "border border-white/10 opacity-40 grayscale-[50%] scale-95"
                        : "border border-white/10 opacity-100 hover:border-[#075473]/40 scale-100";
                    return (
                      <button
                        key={pace.id}
                        type="button"
                        onClick={() => setPaceModal(pace.id)}
                        aria-pressed={isSelected}
                        className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-300 ease-in-out ${cardClass}`}
                      >
                        <span className="relative block aspect-[3/4] w-full bg-zinc-900">
                          {pace.isVideo && pace.mediaUrl ? (
                            <LazyVideo
                              src={pace.mediaUrl}
                              poster={pace.posterUrl || undefined}
                              muted
                              loop
                              playsInline
                              autoPlay
                              className="h-full w-full object-cover"
                            />
                          ) : pace.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pace.image}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "/brand/hero-single-day.jpg";
                              }}
                            />
                          ) : null}
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                            aria-hidden
                          />
                          {isSelected ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D9718C] text-white">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                          ) : null}
                          <span className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                            <span className="block font-godiva text-sm uppercase tracking-wider text-white sm:text-base">
                              {pace.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                              {pace.tagline}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {tourDate ? (
                <p className="text-xs text-white/55">
                  {tourHours}h on{" "}
                  <span className="font-semibold text-white">
                    {formatSingleDayDisplayDate(tourDate)}
                  </span>{" "}
                  · {totalGuests} guest{totalGuests === 1 ? "" : "s"}
                  {travelPace ? ` · ${travelPace}` : ""}
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

          <PaceDetailModal
            paceId={paceModal}
            selected={travelPace}
            onClose={() => setPaceModal(null)}
            onSelect={(id) => {
              setTravelPace(id);
              setPaceModal(null);
            }}
          />

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

function GuestStepper({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-semibold text-white">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
