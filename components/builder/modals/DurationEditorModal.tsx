"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { SeasonalityCard } from "@/components/builder/SeasonalityCard";
import { DatePickerField } from "@/components/ui/CalendarModal";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel } from "../ui";
import { type PaceId } from "@/lib/travelPace";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { PaceDetailModal } from "@/components/builder/modals/PaceDetailModal";
import { SeasonalityDetailModal } from "@/components/builder/modals/SeasonalityDetailModal";

const PRESETS = [10, 14, 21] as const;

export function DurationEditorModal({
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
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const travelPace = useBuilderStore((s) => s.travelPace);
  const setDurationDays = useBuilderStore((s) => s.setDurationDays);
  const setDurationCustom = useBuilderStore((s) => s.setDurationCustom);
  const setArrivalDate = useBuilderStore((s) => s.setArrivalDate);
  const setActiveSeason = useBuilderStore((s) => s.setActiveSeason);
  const setAdults = useBuilderStore((s) => s.setAdults);
  const setChildren = useBuilderStore((s) => s.setChildren);
  const setTravelPace = useBuilderStore((s) => s.setTravelPace);
  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getTravelPaces = useSiteBrandingStore((s) => s.getTravelPaces);
  const travelPaces = getTravelPaces();
  void brandingItems; // subscribe so cards refresh after PB load

  const [mounted, setMounted] = useState(false);
  const [customDraft, setCustomDraft] = useState(String(durationDays));
  const [paceModal, setPaceModal] = useState<PaceId | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

  const totalGuests = adults + children;
  const canDone =
    durationDays > 0 &&
    Boolean(arrivalDate) &&
    travelPace !== null &&
    totalGuests > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
    document.body.style.overflow = "hidden";
  }, [open, ensureBrandingLoaded]);

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
      setDurationDays(parsed);
    }
  };

  const commitCustom = () => {
    const parsed = Number.parseInt(customDraft, 10);
    const next = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
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
          key="duration-editor"
          className="fixed inset-0 z-50 flex items-center justify-center tokio-modal-backdrop bg-[#05080C]/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Configure trip details"
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
                onClick={onClose}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white transition hover:border-zinc-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Configure Trip Details
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-4 pb-12">
              <div>
                <FieldLabel>How many total days will you spend in Japan?</FieldLabel>
                <p className="mt-1 text-xs text-zinc-500">
                  Set the full trip length first — then distribute nights across
                  cities in Locations.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
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
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={customDraft}
                        onChange={(e) => applyCustom(e.target.value)}
                        onBlur={commitCustom}
                        placeholder="e.g. 1, 2, 3, 7"
                        className="w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473]"
                      />
                      <span className="text-sm text-zinc-400">
                        Minimum 1 day · Step 3 nights must total{" "}
                        <strong className="text-white">
                          {Math.max(1, durationDays)}
                        </strong>
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-3">
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

              <div>
                <FieldLabel>Travel pace</FieldLabel>
                <p className="mb-3 text-xs text-zinc-500">
                  Tap a style to learn more, then confirm your preferred rhythm.
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {travelPaces.map((pace) => {
                    const isSelected = travelPace === pace.id;
                    const hasSelection = travelPace !== null;
                    const cardClass = isSelected
                      ? "border-2 border-[#075473] opacity-100 scale-100 z-10"
                      : hasSelection
                        ? "border border-zinc-800 opacity-40 grayscale-[50%] scale-95"
                        : "border border-zinc-800 opacity-100 hover:border-accent-500/40 scale-100";
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
                            <span className="block font-display text-base text-white sm:text-lg">
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

              <div>
                <FieldLabel>Guests</FieldLabel>
                <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <GuestStepper
                    label="Adults"
                    value={adults}
                    onChange={setAdults}
                    min={1}
                  />
                  <GuestStepper
                    label="Children"
                    value={children}
                    onChange={setChildren}
                    min={0}
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Used for airport transfers, vehicles, and hotel room guidance.
                </p>
              </div>
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
    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5 last:border-b-0">
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-white">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          +
        </button>
      </div>
    </div>
  );
}
