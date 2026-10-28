"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarModal } from "@/components/ui/CalendarModal";
import {
  EXPERIENCE_TIMING_OPTIONS,
  experienceTimingNeedsTicketDate,
  formatExperienceTimingOpsNote,
  type ExperienceTimingIntent,
} from "@/lib/experienceTiming";
import { formatSingleDayDisplayDate } from "@/store/useSingleDayBuilderStore";

export type ExperienceTimingResult = {
  timingIntent: ExperienceTimingIntent;
  ticketDate: string | null;
  opsTimingNote: string;
};

/**
 * Ask when an Experience / Ticket should happen relative to the private tour.
 * Other day → date picker for Ticketer.
 */
export function ExperienceTimingModal({
  open,
  title,
  tourDate,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  tourDate: string | null;
  onConfirm: (result: ExperienceTimingResult) => void;
  onCancel: () => void;
}) {
  const [intent, setIntent] = useState<ExperienceTimingIntent | null>(null);
  const [ticketDate, setTicketDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIntent(null);
    setTicketDate(null);
    setCalendarOpen(false);
    setError(null);
  }, [open, title]);

  if (!open) return null;

  const needsDate = experienceTimingNeedsTicketDate(intent);
  const canConfirm =
    intent != null && (!needsDate || Boolean(ticketDate?.trim()));

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="exp-timing"
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="When do you want this experience"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Dismiss"
              onClick={onCancel}
            />
            <motion.div
              className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1017] p-5 shadow-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0080A3]">
                Experiences &amp; tickets
              </p>
              <h3 className="mt-1 font-godiva text-lg font-bold uppercase tracking-wide text-white">
                When do you want this?
              </h3>
              <p className="mt-1.5 text-sm text-white/55">
                <span className="font-semibold text-white/80">{title}</span>
                {" · "}
                Still outside guide hours — Ops needs timing for tickets.
              </p>

              <div className="mt-4 space-y-2">
                {EXPERIENCE_TIMING_OPTIONS.map((opt) => {
                  const active = intent === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setIntent(opt.id);
                        setError(null);
                        if (opt.id !== "other_day") setTicketDate(null);
                      }}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? "border-[#0080A3] bg-[#0080A3]/15"
                          : "border-white/10 bg-[#0D141C] hover:border-white/25"
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-white/45">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {needsDate ? (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                    Ticket date for Ticketer
                  </p>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(true)}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/15 bg-[#0D141C] px-3.5 py-3 text-left text-sm text-white transition hover:border-[#0080A3]"
                  >
                    <span>
                      {ticketDate
                        ? formatSingleDayDisplayDate(ticketDate)
                        : "Choose date…"}
                    </span>
                    <span aria-hidden>📅</span>
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className="mt-3 text-[11px] font-medium text-[#F6A724]">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-full border border-white/15 bg-white/5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!intent) {
                      setError("Pick when you want this experience.");
                      return;
                    }
                    if (needsDate && !ticketDate?.trim()) {
                      setError("Pick the date for this ticket.");
                      return;
                    }
                    onConfirm({
                      timingIntent: intent,
                      ticketDate: needsDate ? ticketDate : tourDate,
                      opsTimingNote: formatExperienceTimingOpsNote({
                        title,
                        timingIntent: intent,
                        ticketDate: needsDate ? ticketDate : tourDate,
                        tourDate,
                      }),
                    });
                  }}
                  disabled={!canConfirm && intent == null}
                  className="rounded-full bg-[#0080A3] py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#006B88] disabled:opacity-40"
                >
                  Add →
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CalendarModal
        open={calendarOpen}
        value={ticketDate}
        onClose={() => setCalendarOpen(false)}
        onSelect={(iso) => {
          setTicketDate(iso);
          setCalendarOpen(false);
          setError(null);
        }}
        disablePast={false}
        title="TICKET DATE"
        eyebrow="When should Ticketer book this?"
      />
    </>
  );
}
