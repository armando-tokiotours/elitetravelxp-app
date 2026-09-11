"use client";

import { useMemo } from "react";
import { useBuilderStore } from "@/store/useBuilderStore";

const SECTIONS = [
  { id: "duration", label: "Duration", check: (s: ReturnType<typeof select>) => !!s.durationDays },
  {
    id: "arrival",
    label: "Arrival",
    check: (s: ReturnType<typeof select>) =>
      !!s.arrivalTransferId && !!s.departureTransferId,
  },
  {
    id: "hotels",
    label: "Hotels",
    check: (s: ReturnType<typeof select>) =>
      !s.needHotels || (!!s.roomType && s.adults + s.children > 0),
  },
  {
    id: "locations",
    label: "Locations",
    check: (s: ReturnType<typeof select>) => {
      const nights = s.locations.reduce((n, l) => n + l.nights, 0);
      return s.locations.length > 0 && nights === s.durationDays;
    },
  },
  {
    id: "tours",
    label: "Tours",
    check: (s: ReturnType<typeof select>) =>
      s.selectedTourIds.length > 0 || s.needDriver || s.locations.length > 0,
  },
] as const;

function select(s: {
  durationDays: number;
  arrivalTransferId: string | null;
  departureTransferId: string | null;
  needHotels: boolean;
  roomType: string;
  adults: number;
  children: number;
  locations: { nights: number }[];
  selectedTourIds: string[];
  needDriver: boolean;
}) {
  return s;
}

export function ProgressBar() {
  const state = useBuilderStore();
  const snapshot = select(state);

  const completed = useMemo(
    () => SECTIONS.filter((sec) => sec.check(snapshot)).length,
    [snapshot]
  );
  const pct = Math.round((completed / SECTIONS.length) * 100);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs text-[#8A8278]">
        <span>Progress</span>
        <span className="font-medium text-[#C4A35A]">
          {completed}/{SECTIONS.length} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E8E2D9]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#C4A35A] to-[#D4AF37] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-1">
        {SECTIONS.map((sec, i) => {
          const done = sec.check(snapshot);
          return (
            <span
              key={sec.id}
              className={`truncate text-[0.65rem] ${
                done ? "text-[#C4A35A]" : "text-[#B8B0A4]"
              }`}
            >
              {i + 1}. {sec.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
