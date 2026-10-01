"use client";

import { useMemo } from "react";
import { addDaysIso } from "@/lib/dateCascade";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/**
 * Read-only Apple-style month strip highlighting the trip date range.
 * Parent button handles clicks — this surface is pointer-events-none.
 */
export function TripRangeMiniCalendar({
  arrivalDate,
  tripDays,
}: {
  arrivalDate: string | null;
  tripDays: number;
}) {
  const model = useMemo(() => {
    if (!arrivalDate || !/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) return null;
    const days = Math.max(1, tripDays || 1);
    const endIso = addDaysIso(arrivalDate, days - 1);
    const [y, m] = arrivalDate.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startPad = monthStart.getDay(); // 0 = Sunday
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const inRange = (day: number) => {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return iso >= arrivalDate && iso <= endIso;
    };
    const isStart = (day: number) => {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return iso === arrivalDate;
    };
    const isEnd = (day: number) => {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return iso === endIso;
    };

    const monthLabel = monthStart.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });

    return { cells, monthLabel, inRange, isStart, isEnd, y, m };
  }, [arrivalDate, tripDays]);

  if (!model) {
    return (
      <div
        className="pointer-events-none mt-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2"
        aria-hidden
      >
        <p className="text-center text-[9px] uppercase tracking-wider text-zinc-600">
          Calendar preview
        </p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none mt-2 select-none rounded-lg border border-white/10 bg-black/40 px-1.5 pb-1.5 pt-1"
      aria-hidden
    >
      <p className="mb-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        {model.monthLabel}
      </p>
      <div className="mb-0.5 grid grid-cols-7 gap-px">
        {WEEKDAYS.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="text-center text-[8px] font-medium text-zinc-600"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {model.cells.map((day, i) => {
          if (day == null) {
            return <span key={`e-${i}`} className="h-4" />;
          }
          const range = model.inRange(day);
          const start = model.isStart(day);
          const end = model.isEnd(day);
          return (
            <span
              key={`d-${day}`}
              className={`flex h-4 items-center justify-center text-[8px] leading-none ${
                start || end
                  ? "rounded-full bg-[#D91147] font-bold text-white"
                  : range
                    ? "bg-[#D91147]/35 font-medium text-rose-100"
                    : "text-zinc-500"
              }`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
