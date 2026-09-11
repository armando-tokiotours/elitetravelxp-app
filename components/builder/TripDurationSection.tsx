"use client";

import { useBuilderStore } from "@/store/useBuilderStore";
import { SectionBlock } from "./ui";

const OPTIONS = [10, 14, 21] as const;

export function TripDurationSection() {
  const durationDays = useBuilderStore((s) => s.durationDays);
  const setDurationDays = useBuilderStore((s) => s.setDurationDays);

  return (
    <SectionBlock number={1} title="Trip Duration" id="section-duration">
      <div className="flex flex-wrap gap-2.5">
        {OPTIONS.map((days) => {
          const active = durationDays === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => setDurationDays(days)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide transition ${
                active
                  ? "bg-[#0B1F3A] text-white shadow-md"
                  : "border border-[#D9D2C7] bg-white text-[#0B1F3A] hover:border-[#C4A35A]"
              }`}
            >
              {days} days
            </button>
          );
        })}
      </div>
    </SectionBlock>
  );
}
