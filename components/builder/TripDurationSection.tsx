"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PbSeasonTier } from "@/lib/pocketbase/client";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel, SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { formatDisplayDate } from "@/store/useBuilderStore";

const PRESETS = [10, 14, 21] as const;

export function TripDurationSection({
  seasonTiers = [],
}: {
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

  const [customDraft, setCustomDraft] = useState(String(durationDays));

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

  return (
    <SectionBlock
      number={1}
      title="Trip Duration"
      id="section-duration"
      icon="calendar"
      summary={`${durationDays} day${durationDays === 1 ? "" : "s"}${
        arrivalDate ? ` · ${formatDisplayDate(arrivalDate)}` : ""
      }`}
    >
      <div className="flex flex-wrap gap-2.5">
        {PRESETS.map((days) => (
          <ChoicePill
            key={days}
            active={!durationCustom && durationDays === days}
            onClick={() => selectPreset(days)}
          >
            {days} days
          </ChoicePill>
        ))}
        <ChoicePill active={durationCustom} onClick={selectCustom}>
          Custom
        </ChoicePill>
      </div>

      {durationCustom ? (
        <div className="mt-4 rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] p-4">
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
              className="w-36 rounded-xl border border-[#D9D2C7] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
            />
            <span className="text-sm text-[#8A8278]">
              Minimum 1 day · Step 4 nights must total{" "}
              <strong className="text-[#0B1F3A]">
                {Math.max(1, durationDays)}
              </strong>
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <FieldLabel>Arrival date</FieldLabel>
        <input
          type="date"
          value={arrivalDate ?? ""}
          onChange={(e) => setArrivalDate(e.target.value || null)}
          className="mt-1 w-full max-w-xs rounded-xl border border-[#D9D2C7] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
        />
        <p className="mt-1.5 text-xs text-[#8A8278]">
          Used for seasonality, hotel rates, concierge notes, and departure
          date.
        </p>

        <AnimatePresence mode="wait">
          {activeSeasonTier && activeSeasonNote ? (
            <motion.div
              key={`${activeSeasonTier}-${activeSeasonNote.note.slice(0, 24)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="mt-3 rounded-2xl border border-[#E5D4A8] bg-[#FBF6EA] px-4 py-3 text-sm text-[#0B1F3A]"
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <SeasonLeafIcon />
                <span>{activeSeasonTier} Season</span>
                {activeSeasonNote.crowds ? (
                  <span className="font-normal text-[#5C6570]">
                    · {activeSeasonNote.crowds}
                  </span>
                ) : null}
              </p>
              {activeSeasonNote.note ? (
                <p className="mt-1.5 text-[#3D4A5C] leading-relaxed">
                  {activeSeasonNote.note}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <SectionContinue next={2} label="Continue to Arrival" />
    </SectionBlock>
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
        stroke="#0B1F3A"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
