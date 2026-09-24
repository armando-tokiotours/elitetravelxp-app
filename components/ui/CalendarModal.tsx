"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

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

function fromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return startOfDay(new Date(y, m - 1, d));
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDay(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function calendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type CalendarModalProps = {
  open: boolean;
  value: string | null;
  onClose: () => void;
  onSelect: (iso: string) => void;
  /** Disallow dates before today (default true). */
  disablePast?: boolean;
  title?: string;
  eyebrow?: string;
};

/**
 * Root-level date picker portal — floats above modals (z-9999)
 * with a dismissible backdrop (z-9998). Mobile-safe 44px targets.
 */
export function CalendarModal({
  open,
  value,
  onClose,
  onSelect,
  disablePast = true,
  title = "CHOOSE ARRIVAL DATE",
  eyebrow = "Calendar",
}: CalendarModalProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => fromIso(value), [value]);
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const base = selected ?? today;
    setView({ year: base.getFullYear(), month: base.getMonth() });
  }, [open, selected, today]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cells = useMemo(
    () => calendarCells(view.year, view.month),
    [view.year, view.month]
  );

  const pick = (day: Date) => {
    if (disablePast && day.getTime() < today.getTime()) return;
    onSelect(toIso(day));
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="cal-backdrop"
            type="button"
            aria-label="Dismiss calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="tokio-modal-backdrop fixed inset-0 z-[9998]"
            onClick={onClose}
            onTouchEnd={(e) => {
              e.preventDefault();
              onClose();
            }}
          />
          <motion.div
            key="cal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="tokio-modal-content fixed inset-x-0 bottom-0 z-[9999] mx-auto flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 p-5 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-[#075473] uppercase">
                  {eyebrow}
                </p>
                <h2 className="mt-1 font-display text-xl text-white">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onClose();
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white"
                aria-label="Close calendar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
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
                    className="py-1 text-center text-[10px] tracking-wider text-white/35 uppercase"
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
                  const disabled =
                    disablePast && day.getTime() < today.getTime();
                  const isSelected = selected ? sameDay(day, selected) : false;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(day)}
                      onTouchEnd={(e) => {
                        if (disabled) return;
                        e.preventDefault();
                        pick(day);
                      }}
                      className={`flex min-h-[44px] items-center justify-center rounded-lg text-sm transition ${
                        disabled
                          ? "cursor-not-allowed text-white/20"
                          : isSelected
                            ? "bg-[#075473] font-medium text-white"
                            : "text-white/80 hover:bg-white/10 active:bg-white/15"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-[11px] text-white/45">
                {selected
                  ? `Selected: ${formatDay(selected)}`
                  : "Select your arrival date"}
              </p>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

type DatePickerTriggerProps = {
  value: string | null;
  onChange: (iso: string | null) => void;
  label?: string;
  /** Calendar header — default preserves Multi-Day wording. */
  title?: string;
  disablePast?: boolean;
};

/** Arrival-date trigger + portal calendar for builder configure sheets. */
export function DatePickerField({
  value,
  onChange,
  label = "Arrival date",
  title = "CHOOSE ARRIVAL DATE",
  disablePast = true,
}: DatePickerTriggerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);

  const openPicker = () => setOpen(true);

  return (
    <>
      <div className="flex min-h-[44px] flex-col justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
        <button
          type="button"
          onClick={openPicker}
          onTouchEnd={(e) => {
            e.preventDefault();
            openPicker();
          }}
          className="relative mt-1 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-transparent py-1.5 text-left text-sm text-white outline-none transition active:bg-white/5"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={selected ? "text-white" : "text-zinc-500"}>
            {selected ? formatDay(selected) : "Tap to choose date"}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </button>
      </div>

      <CalendarModal
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(iso) => onChange(iso)}
        disablePast={disablePast}
        title={title}
        eyebrow="Calendar"
      />
    </>
  );
}
