"use client";

import { useMemo } from "react";
import {
  calculateSingleDayQuote,
  formatEur,
  formatYen,
  guidePreferenceLabel,
} from "@/lib/singleDayPricing";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  calculateDayEndTime,
  calculateTimeSlots,
  formatClock12h,
} from "@/lib/singleDayTimeSlots";
import {
  SingleDayTimelineInfographic,
  type TimelineStop,
} from "@/components/builder-single/SingleDayTimelineInfographic";

/**
 * Printable Single-Day invoice — dark glassmorphic TOKIOTOURS ticket theme.
 */
export function SingleDayInvoicePrint({
  embedded = false,
  showToolbar = true,
  onPrintRequest,
}: {
  embedded?: boolean;
  showToolbar?: boolean;
  onPrintRequest?: () => void;
} = {}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

  const pnr = (confirmedBookingRef || tempBookingRef || "—").toUpperCase();

  const quote = useMemo(
    () =>
      calculateSingleDayQuote({
        guidePreference,
        tourHours,
        experiencePrices: selectedExperiences.map((e) => Number(e.price) || 0),
        conciergeActive,
      }),
    [guidePreference, tourHours, selectedExperiences, conciergeActive]
  );

  const timedStops = useMemo(
    () => calculateTimeSlots(startTime || "09:00", selectedExperiences),
    [startTime, selectedExperiences]
  );

  const printStops: TimelineStop[] = useMemo(
    () =>
      timedStops.map((stop) => ({
        ...stop,
        vibeLabel: "Experience",
        ringTone: stop.stopNumber % 2 === 1 ? "red" : "cyan",
      })),
    [timedStops]
  );

  const endTime = useMemo(
    () =>
      timedStops.length > 0
        ? calculateDayEndTime(startTime || "09:00", selectedExperiences)
        : calculateDayEndTime(startTime || "09:00", [
            { duration_hours: tourHours },
          ]),
    [timedStops.length, startTime, selectedExperiences, tourHours]
  );

  const guests = `${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"}`;
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";

  return (
    <div
      id="single-day-invoice-content"
      className={`print-document text-white ${
        embedded ? "" : "min-h-screen bg-[#05080C]"
      }`}
    >
      {!embedded && showToolbar ? (
        <div className="no-print border-b border-white/10 bg-[#0D1117] px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Single-Day Invoice
            </p>
            <button
              type="button"
              onClick={() =>
                onPrintRequest ? onPrintRequest() : window.print()
              }
              className="rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      ) : null}

      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/95 px-5 py-8 shadow-2xl backdrop-blur-md sm:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-[#075473]/40 bg-[#05080C] px-5 py-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #075473 0%, transparent 45%), radial-gradient(circle at 80% 0%, #E60F43 0%, transparent 40%)",
            }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tokiotours-logo.png"
                alt="TOKIOTOURS"
                className="h-12 w-12 rounded-full object-cover"
              />
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#E60F43]">
                TOKIOTOURS
              </p>
              <h1 className="mt-1 font-godiva text-2xl uppercase tracking-wider text-white sm:text-3xl">
                Single-Day Tour Ticket
              </h1>
              <p className="mt-2 text-sm text-white/55">
                Private day package — transit, guide, and selected experiences.
              </p>
            </div>
            <div className="rounded-xl border border-[#F6A724]/40 bg-black/40 px-3 py-2 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
                PNR
              </p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#F6A724]">
                {pnr}
              </p>
            </div>
          </div>
        </header>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <Meta label="City Hub" value={cityFocus.trim() || "—"} />
          <Meta label="Date & Duration" value={`${dateLabel} · ${tourHours}h`} />
          <Meta label="Guests" value={guests} />
          <Meta
            label="Language / Guide"
            value={`${preferredTourLanguage || "EN"} · ${guidePreferenceLabel(guidePreference)} · ${formatClock12h(startTime || "09:00")}`}
          />
          {meetingPoint ? (
            <Meta label="Meeting point" value={meetingPoint} />
          ) : null}
        </dl>

        {printStops.length > 0 ? (
          <section className="sd-timeline-print-section mt-8">
            <SingleDayTimelineInfographic
              stops={printStops}
              startTime={startTime || "09:00"}
              endTime={endTime}
              totalHours={tourHours}
              cityLabel={cityFocus.trim() || undefined}
              variant="print"
            />
            <ul className="mt-4 space-y-1.5 text-sm">
              {timedStops.map((stop) => (
                <li
                  key={`price-${stop.tourId}-${stop.stopNumber}`}
                  className="flex justify-between gap-4 border-b border-white/10 pb-1.5"
                >
                  <span className="text-white/65">
                    STOP {String(stop.stopNumber).padStart(2, "0")} ·{" "}
                    {stop.title}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-white">
                    {stop.price != null && stop.price > 0
                      ? formatEur(stop.price)
                      : "Incl."}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-godiva text-sm uppercase tracking-wider text-white/50">
            Itemized Breakdown
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {quote.lines.map((line) => (
              <li
                key={line.id}
                className="flex items-start justify-between gap-4 border-b border-white/10 pb-2.5"
              >
                <span className="text-white/75">{line.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-white">
                  {formatEur(line.amountEur)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-[#075473]/50 bg-[#075473]/20 px-5 py-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#00B4D8]">
            Estimated Single-Day Package
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-white">
            {formatEur(quote.totalEur)}
          </p>
          <p className="mt-1 text-sm text-white/60 tabular-nums">
            ≈ {formatYen(quote.totalYen)}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            Estimate for planning. Final confirmation may adjust ticket
            availability, guide language, and seasonal surcharges.
          </p>
        </section>

        <p className="mt-8 text-center text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
          TOKIOTOURS · Single-Day Private Tour
        </p>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/40">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-white">{value}</dd>
    </div>
  );
}
