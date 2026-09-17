"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, Info } from "lucide-react";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import {
  useBuilderStore,
  type SeasonTierName,
  type TravelPace,
} from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel } from "../ui";
import { TRAVEL_PACES, type PaceId } from "@/lib/travelPace";

const PRESETS = [10, 14, 21] as const;
const SEASON_IMAGES: Record<SeasonTierName, string> = {
  Low: "/photo/season-low.jpg",
  Mid: "/photo/season-mid.jpg",
  High: "/photo/season-high.jpg",
};

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Configure trip details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0a0a0a] md:h-[85vh] md:max-w-2xl md:rounded-2xl md:border md:border-zinc-800"
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Configure
                </p>
                <h3 className="truncate font-display text-2xl text-white">
                  Configure Trip Details
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-4 pb-12">
              <div>
                <FieldLabel>Trip duration</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESETS.map((days) => (
                    <ChoicePill
                      key={days}
                      size="sm"
                      active={!durationCustom && durationDays === days}
                      onClick={() => selectPreset(days)}
                    >
                      {days} days
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
                        className="w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[#C4A35A]"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <FieldLabel>Arrival date</FieldLabel>
                  <label className="relative mt-1 block">
                    <input
                      type="date"
                      value={arrivalDate ?? ""}
                      onChange={(e) => setArrivalDate(e.target.value || null)}
                      className="w-full bg-transparent py-1.5 text-sm text-white outline-none [color-scheme:dark] focus:outline-none"
                    />
                    <CalendarDays
                      className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                      aria-hidden
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (activeSeasonTier && activeSeasonNote) {
                      setSeasonModalOpen(true);
                    }
                  }}
                  disabled={!activeSeasonTier || !activeSeasonNote}
                  className={`flex flex-col justify-center rounded-xl border border-amber-500/50 bg-zinc-900 p-3 text-left transition-all ${
                    activeSeasonTier && activeSeasonNote
                      ? "cursor-pointer hover:bg-zinc-800"
                      : "cursor-default opacity-80"
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Seasonality
                  </p>
                  <AnimatePresence mode="wait">
                    {activeSeasonTier && activeSeasonNote ? (
                      <motion.div
                        key={`${activeSeasonTier}-${activeSeasonNote.note.slice(0, 24)}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1.5"
                      >
                        <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-white">
                          <SeasonLeafIcon />
                          <span>{activeSeasonTier} Season</span>
                        </p>
                        {activeSeasonNote.crowds ? (
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {activeSeasonNote.crowds}
                          </p>
                        ) : null}
                        {activeSeasonNote.note ? (
                          <p className="mt-2 hidden text-xs leading-relaxed text-zinc-500 md:block">
                            {activeSeasonNote.note}
                          </p>
                        ) : null}
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#C4A35A]">
                          <Info className="h-3 w-3 shrink-0" aria-hidden />
                          Tap to learn more
                        </p>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="empty-season"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-1.5 text-xs text-zinc-500"
                      >
                        Select a date for insights
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              <div>
                <FieldLabel>Travel pace</FieldLabel>
                <p className="mb-3 text-xs text-zinc-500">
                  Tap a style to learn more, then confirm your preferred rhythm.
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {TRAVEL_PACES.map((pace) => {
                    const isSelected = travelPace === pace.id;
                    const hasSelection = travelPace !== null;
                    const cardClass = isSelected
                      ? "border-2 border-[#C4A35A] opacity-100 scale-100 z-10"
                      : hasSelection
                        ? "border border-zinc-800 opacity-40 grayscale-[50%] scale-95"
                        : "border border-zinc-800 opacity-100 hover:border-amber-400 scale-100";
                    return (
                      <button
                        key={pace.id}
                        type="button"
                        onClick={() => setPaceModal(pace.id)}
                        aria-pressed={isSelected}
                        className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-300 ease-in-out ${cardClass}`}
                      >
                        <span className="relative block aspect-[3/4] w-full bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pace.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                            aria-hidden
                          />
                          {isSelected ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#C4A35A] text-[#0B1F3A]">
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

            <div className="flex flex-shrink-0 border-t border-zinc-800 bg-[#0a0a0a]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                disabled={!canDone}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </motion.div>

          <TravelPaceModal
            paceId={paceModal}
            selected={travelPace}
            onClose={() => setPaceModal(null)}
            onSelect={(id) => {
              setTravelPace(id);
              setPaceModal(null);
            }}
          />

          <SeasonalityExplainerModal
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

function SeasonalityExplainerModal({
  open,
  onClose,
  tier,
  crowds,
  note,
}: {
  open: boolean;
  onClose: () => void;
  tier: SeasonTierName | null;
  crowds: string;
  note: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !tier) return null;

  const image = SEASON_IMAGES[tier] || SEASON_IMAGES.Mid;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="season-explainer"
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${tier} Season`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/55"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Seasonality
                </p>
                <h3 className="truncate font-display text-2xl text-[#0B1F3A]">
                  {tier} Season
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
                <div className="relative aspect-[4/5] max-h-[45dvh] w-full bg-[#0B1F3A] sm:max-h-[50dvh]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-4 py-4 sm:px-5">
                  {crowds ? (
                    <p className="text-sm font-semibold text-[#C4A35A]">
                      {crowds}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-[#5C6570]">
                    {note ||
                      "Seasonal conditions for your arrival date will appear here once configured in Team Access."}
                  </p>
                </div>
              </article>
            </div>

            <div className="shrink-0 border-t border-[#EEE8DF] bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-[#D9D2C7] bg-white py-3.5 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#F7F3EB]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function TravelPaceModal({
  paceId,
  selected,
  onClose,
  onSelect,
}: {
  paceId: PaceId | null;
  selected: TravelPace;
  onClose: () => void;
  onSelect: (id: PaceId) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const pace = paceId ? TRAVEL_PACES.find((p) => p.id === paceId) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!paceId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [paceId]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {pace ? (
        <motion.div
          key="pace-explainer"
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pace.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/55"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Travel pace
                </p>
                <h3 className="truncate font-display text-2xl text-[#0B1F3A]">
                  {pace.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
                <div className="relative aspect-[4/5] max-h-[45dvh] w-full bg-[#0B1F3A] sm:max-h-[50dvh]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pace.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-[#C4A35A]">
                    {pace.tagline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C6570]">
                    {pace.description}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#5C6570]">
                    {pace.detail}
                  </p>
                </div>
              </article>
            </div>

            <div className="shrink-0 border-t border-[#EEE8DF] bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={() => onSelect(pace.id)}
                className="w-full rounded-full bg-[#0B1F3A] py-3.5 text-sm font-semibold text-white transition hover:bg-[#143052]"
              >
                {selected === pace.id
                  ? "✓ Selected — keep this pace"
                  : `Select ${pace.label} pace`}
              </button>
            </div>
          </motion.div>
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

function SeasonLeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c4 2 7 6 7 10a7 7 0 11-14 0c0-4 3-8 7-10z"
        stroke="#C4A35A"
        strokeWidth="1.6"
        fill="#C4A35A"
        fillOpacity="0.25"
      />
      <path
        d="M12 7v10"
        stroke="#C4A35A"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
