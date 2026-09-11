"use client";

import { useEffect, useState } from "react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ChoicePill, FieldLabel, SectionBlock } from "./ui";
import { SectionContinue } from "./SectionContinue";
import { formatDisplayDate } from "@/store/useBuilderStore";

const PRESETS = [10, 14, 21] as const;

export function TripDurationSection() {
  const durationDays = useBuilderStore((s) => s.durationDays);
  const durationCustom = useBuilderStore((s) => s.durationCustom);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const setDurationDays = useBuilderStore((s) => s.setDurationDays);
  const setDurationCustom = useBuilderStore((s) => s.setDurationCustom);
  const setArrivalDate = useBuilderStore((s) => s.setArrivalDate);

  const [customDraft, setCustomDraft] = useState(String(durationDays));

  useEffect(() => {
    if (durationCustom) setCustomDraft(String(durationDays));
  }, [durationCustom, durationDays]);

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
              <strong className="text-[#0B1F3A]">{Math.max(1, durationDays)}</strong>
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
          Used for seasonal concierge suggestions and departure date calculation.
        </p>
      </div>
      <SectionContinue next={2} label="Continue to Arrival" />
    </SectionBlock>
  );
}
