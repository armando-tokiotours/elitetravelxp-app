"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, X } from "lucide-react";
import type { PreEliteTiming, TripType } from "@/lib/preEliteBuilder";
import { buildTimingPayload, emptyTiming } from "@/lib/preEliteBuilder";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";

type TimingMode = "dates" | "month";

type Props = {
  value: PreEliteTiming;
  onChange: (value: PreEliteTiming) => void;
  /** When single_day, lock duration to 1 and hide the days counter. */
  tripType?: TripType | null;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MIN_DAYS = 1;
const MAX_DAYS = 45;
const DEFAULT_DAYS = 10;

type SeasonMeta = {
  season: string;
  peak?: string;
};

function seasonForMonth(monthIndex: number): SeasonMeta {
  if (monthIndex === 2 || monthIndex === 3) {
    return { season: "Spring", peak: "Cherry Blossom Season" };
  }
  if (monthIndex === 4 || monthIndex === 5) {
    return { season: "Early Summer", peak: "Fresh Greens" };
  }
  if (monthIndex === 6 || monthIndex === 7) {
    return { season: "Summer", peak: "Festival Season" };
  }
  if (monthIndex === 8 || monthIndex === 9) {
    return { season: "Autumn", peak: "Autumn Leaves" };
  }
  if (monthIndex === 10 || monthIndex === 11) {
    return { season: "Late Autumn", peak: "Quiet Temples" };
  }
  return { season: "Winter", peak: "Snow & Illuminations" };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function fromIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function normalizeSingleDay(value: PreEliteTiming): PreEliteTiming {
  return buildTimingPayload({
    startDate: value.startDate ? fromIso(value.startDate) : null,
    targetMonth: value.startDate ? null : value.targetMonth,
    totalDays: 1,
  });
}

function buildMonthOptions(from: Date, count: number) {
  const items: {
    key: string;
    year: number;
    monthIndex: number;
    label: string;
    short: string;
    season: string;
    peak?: string;
  }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  for (let i = 0; i < count; i += 1) {
    const meta = seasonForMonth(m);
    items.push({
      key: `${y}-${m}`,
      year: y,
      monthIndex: m,
      label: formatMonthLabel(y, m),
      short: `${SHORT_MONTHS[m]} ${y}`,
      season: meta.season,
      peak: meta.peak,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return items;
}

function calendarCells(viewYear: number, viewMonth: number): (Date | null)[] {
  const first = new Date(viewYear, viewMonth, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DaysCounter({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] tracking-[0.14em] text-[#075473] uppercase">
        How many days in Japan?
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Fewer days"
          disabled={value <= MIN_DAYS}
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <p className="min-w-[5.5rem] text-center text-sm text-white">
          {value} {value === 1 ? "Day" : "Days"}
        </p>
        <button
          type="button"
          aria-label="More days"
          disabled={value >= MAX_DAYS}
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TimingSelector({ value, onChange, tripType }: Props) {
  const singleDay = tripType === "single_day";
  const today = useMemo(() => startOfDay(new Date()), []);
  /** Block today + tomorrow — earliest arrival is day after tomorrow. */
  const minArrival = useMemo(() => addDays(today, 2), [today]);
  const initialStart = value.startDate ? fromIso(value.startDate) : null;

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<TimingMode>(() =>
    value.targetMonth && !value.startDate ? "month" : "dates"
  );
  const [arrival, setArrival] = useState<Date | null>(initialStart);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(() => {
    if (!value.targetMonth) return null;
    const match = value.targetMonth.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return null;
    const idx = MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === match[1].toLowerCase()
    );
    if (idx < 0) return null;
    return `${match[2]}-${idx}`;
  });
  const [totalDays, setTotalDays] = useState(() =>
    singleDay ? 1 : value.totalDays || DEFAULT_DAYS
  );
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const [monthQuery, setMonthQuery] = useState("");
  const monthRootRef = useRef<HTMLDivElement>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const monthSearchRef = useRef<HTMLInputElement>(null);
  const [monthMenuPos, setMonthMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [view, setView] = useState(() => {
    const anchor = initialStart || today;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

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

  useEffect(() => {
    if (!monthDropOpen) {
      setMonthMenuPos(null);
      return;
    }
    const place = () => {
      const btn = monthBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - r.bottom - gap - 16;
      const spaceAbove = r.top - gap - 16;
      const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
      const maxHeight = Math.min(320, Math.max(140, preferBelow ? spaceBelow : spaceAbove));
      const top = preferBelow
        ? r.bottom + gap
        : Math.max(8, r.top - gap - maxHeight);
      setMonthMenuPos({
        top,
        left: r.left,
        width: r.width,
        maxHeight,
      });
    };
    place();
    const t = window.setTimeout(() => monthSearchRef.current?.focus(), 40);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (monthRootRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.("[data-month-season-menu]")) return;
      setMonthDropOpen(false);
      setMonthQuery("");
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [monthDropOpen]);

  const monthOptions = useMemo(
    () =>
      buildMonthOptions(
        new Date(today.getFullYear(), today.getMonth() + 1, 1),
        24
      ),
    [today]
  );

  const filteredMonths = useMemo(() => {
    const q = monthQuery.trim().toLowerCase();
    if (!q) return monthOptions;
    return monthOptions.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.season.toLowerCase().includes(q) ||
        m.short.toLowerCase().includes(q) ||
        (m.peak || "").toLowerCase().includes(q)
    );
  }, [monthOptions, monthQuery]);

  const cells = useMemo(
    () => calendarCells(view.year, view.month),
    [view.year, view.month]
  );

  const emit = (next: {
    mode: TimingMode;
    arrival: Date | null;
    monthKey: string | null;
    days: number;
  }) => {
    const days = singleDay ? 1 : next.days;
    if (next.mode === "dates") {
      if (!next.arrival) {
        onChange({
          ...emptyTiming(),
          totalDays: days,
        });
        return;
      }
      onChange(
        buildTimingPayload({
          startDate: next.arrival,
          totalDays: days,
        })
      );
      return;
    }

    const found = next.monthKey
      ? monthOptions.find((m) => m.key === next.monthKey)
      : null;
    if (!found) {
      onChange({
        ...emptyTiming(),
        totalDays: days,
      });
      return;
    }
    onChange(
      buildTimingPayload({
        targetMonth: found.label,
        totalDays: days,
      })
    );
  };

  useEffect(() => {
    if (!singleDay) return;
    if (totalDays === 1 && value.totalDays === 1) return;
    setTotalDays(1);
    if (arrival) {
      onChange(buildTimingPayload({ startDate: arrival, totalDays: 1 }));
    } else if (selectedMonthKey) {
      const found = monthOptions.find((m) => m.key === selectedMonthKey);
      if (found) {
        onChange(buildTimingPayload({ targetMonth: found.label, totalDays: 1 }));
      }
    } else if (value.formattedString) {
      onChange(normalizeSingleDay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lock duration when trip type flips
  }, [singleDay]);

  const switchMode = (next: TimingMode) => {
    setMode(next);
    emit({
      mode: next,
      arrival,
      monthKey: selectedMonthKey,
      days: totalDays,
    });
  };

  const pickDay = (day: Date) => {
    if (day.getTime() < minArrival.getTime()) return;
    setArrival(day);
    emit({
      mode: "dates",
      arrival: day,
      monthKey: selectedMonthKey,
      days: totalDays,
    });
    useSeasonalFxStore.getState().triggerFromDate(day);
    setOpen(false);
  };

  const pickMonth = (key: string) => {
    setSelectedMonthKey(key);
    setMode("month");
    emit({
      mode: "month",
      arrival: null,
      monthKey: key,
      days: totalDays,
    });
    const found = monthOptions.find((m) => m.key === key);
    if (found) {
      useSeasonalFxStore.getState().triggerFromMonthLabel(found.label);
    }
    setMonthDropOpen(false);
    setMonthQuery("");
  };

  const changeDays = (days: number) => {
    const next = singleDay ? 1 : days;
    setTotalDays(next);
    emit({
      mode,
      arrival,
      monthKey: selectedMonthKey,
      days: next,
    });
  };

  const departure =
    arrival && mode === "dates" && !singleDay
      ? addDays(arrival, totalDays)
      : null;

  const summaryLabel = value.formattedString
    ? value.startDate && arrival
      ? formatDay(arrival)
      : value.targetMonth
        ? value.targetMonth
        : value.formattedString
    : null;

  const calendarPanel = (
    <div className="grid gap-3">
      <div
        role="tablist"
        aria-label="Timing mode"
        className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "dates"}
          onClick={() => switchMode("dates")}
          className={`rounded-lg px-2.5 py-2 text-xs transition ${
            mode === "dates"
              ? "bg-[#075473] text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Specific Dates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "month"}
          onClick={() => switchMode("month")}
          className={`rounded-lg px-2.5 py-2 text-xs transition ${
            mode === "month"
              ? "bg-[#075473] text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          Target Month / Season
        </button>
      </div>

      {mode === "dates" ? (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setView((v) => {
                  const d = new Date(v.year, v.month - 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })
              }
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-xs tracking-wide text-[#075473]">
              {MONTH_NAMES[view.month]} {view.year}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setView((v) => {
                  const d = new Date(v.year, v.month + 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })
              }
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-0.5 text-center text-[10px] tracking-wider text-white/35 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[44px]" />;
              }
              const disabled = day.getTime() < minArrival.getTime();
              const selected = arrival ? sameDay(day, arrival) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={`flex min-h-[44px] items-center justify-center rounded-lg text-sm transition ${
                    disabled
                      ? "cursor-not-allowed text-white/20"
                      : selected
                        ? "bg-[#075473] font-medium text-white"
                        : "text-white/80 hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-white/45">
            {arrival
              ? `${singleDay ? "Tour date" : "Arrival"}: ${formatDay(arrival)}`
              : `Select your ${singleDay ? "tour" : "arrival"} date (from ${formatDay(minArrival)} — not today or tomorrow)`}
          </p>
        </div>
      ) : (
        <div ref={monthRootRef} className="relative">
          <button
            ref={monthBtnRef}
            type="button"
            aria-label="Target month or season"
            aria-expanded={monthDropOpen}
            onClick={() => setMonthDropOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-left text-sm text-white transition hover:border-white/25"
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedMonthKey
                ? (() => {
                    const found = monthOptions.find((m) => m.key === selectedMonthKey);
                    return found
                      ? `${found.season} · ${found.short}`
                      : "Choose month / season";
                  })()
                : "Choose month / season"}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-white/50 transition ${
                monthDropOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {mounted &&
            monthDropOpen &&
            monthMenuPos &&
            createPortal(
              <div
                data-month-season-menu
                className="fixed z-[10050] overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117] shadow-2xl"
                style={{
                  top: monthMenuPos.top,
                  left: monthMenuPos.left,
                  width: monthMenuPos.width,
                }}
              >
                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
                  <input
                    ref={monthSearchRef}
                    value={monthQuery}
                    onChange={(e) => setMonthQuery(e.target.value)}
                    placeholder="Search month or season…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  />
                  {monthQuery ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setMonthQuery("")}
                      className="rounded-full p-1 text-white/40 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <ul
                  className="overflow-y-auto overscroll-contain py-1"
                  style={{ maxHeight: monthMenuPos.maxHeight }}
                  role="listbox"
                >
                  {filteredMonths.length === 0 ? (
                    <li className="px-3 py-3 text-center text-xs text-white/40">
                      No months match
                    </li>
                  ) : (
                    filteredMonths.map((item) => {
                      const selected = selectedMonthKey === item.key;
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => pickMonth(item.key)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                              selected
                                ? "bg-[#075473]/25 text-white"
                                : "text-white/85"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {item.season}
                                <span className="text-white/40"> · </span>
                                <span className="text-[#075473]">{item.short}</span>
                              </span>
                              {item.peak ? (
                                <span className="mt-0.5 block truncate text-[10px] text-white/45">
                                  {item.peak}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
                <p className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/35">
                  {monthOptions.length} months · scroll or type to find
                </p>
              </div>,
              document.body
            )}
        </div>
      )}

      {!singleDay ? (
        <DaysCounter value={totalDays} onChange={changeDays} />
      ) : (
        <p className="text-[11px] text-white/45">
          Single-day tours are scheduled for one calendar day.
        </p>
      )}

      {mode === "dates" && arrival && departure ? (
        <p className="text-[11px] leading-relaxed text-white/55">
          Arrival:{" "}
          <span className="text-white/80">{formatDay(arrival)}</span>
          <span className="mx-1.5 text-[#075473]">→</span>
          Inferred Departure:{" "}
          <span className="text-white/80">{formatDay(departure)}</span>
          <span className="text-white/40">
            {" "}
            ({totalDays} {totalDays === 1 ? "Day" : "Days"})
          </span>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 flex min-h-[40px] items-center justify-center rounded-xl border border-white/10 bg-[#121212] px-1.5">
          {summaryLabel ? (
            <span className="truncate text-center text-[0.7rem] font-semibold leading-tight tracking-wide text-[#F29727] sm:text-xs">
              {summaryLabel}
            </span>
          ) : (
            <span className="text-xs text-white/25">—</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="col-span-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[#075473]/50 bg-[#075473]/15 px-2 py-2.5 text-[0.7rem] font-semibold tracking-[0.1em] text-white uppercase transition hover:bg-[#075473]/25 sm:px-4 sm:text-sm sm:tracking-[0.12em]"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-[#075473]" />
          <span className="truncate">Select travel date(s)</span>
        </button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open ? (
              <motion.div
                key="timing-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="tokio-modal-backdrop fixed inset-0 z-[9998] flex items-center justify-center p-4"
                onClick={() => setOpen(false)}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="timing-modal-title"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="tokio-modal-content relative z-[9999] max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 p-5 sm:p-6"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] tracking-[0.18em] text-[#075473] uppercase">
                        Timing
                      </p>
                      <h2
                        id="timing-modal-title"
                        className="mt-1 font-display text-xl text-white"
                      >
                        {singleDay ? "Choose your tour date" : "Choose travel dates"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-white/15 p-2 text-white/60 hover:text-white"
                      aria-label="Close date picker"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {calendarPanel}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
