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
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
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
 * Printable 1-page Single-Day invoice — isolated from multi-day PrintItineraryDocument.
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
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

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
      className={`print-document text-[#0B1F3A] ${
        embedded ? "" : "min-h-screen bg-[#F5F0E8]"
      }`}
    >
      {!embedded && showToolbar ? (
        <div className="no-print border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">Single-Day Invoice</p>
            <button
              type="button"
              onClick={() =>
                onPrintRequest ? onPrintRequest() : window.print()
              }
              className="rounded-full bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      ) : null}

      <article className="mx-auto max-w-3xl bg-white px-5 py-8 sm:px-8">
        <header className="border-b border-[#E8E2D9] pb-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#8A8278]">
            TOKIOTOURS
          </p>
          <h1 className="mt-2 font-godiva text-2xl uppercase tracking-wider sm:text-3xl">
            Single-Day Tour Quotation
          </h1>
          <p className="mt-2 text-sm text-[#8A8278]">
            Private day package — transit, guide, and selected experiences.
          </p>
        </header>

        <div className="mt-5">
          <BookingRefBadge
            tempBookingRef={tempBookingRef}
            confirmedBookingRef={confirmedBookingRef}
            bookingStatus={bookingStatus}
            variant="inline"
          />
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#8A8278]">
              City Hub
            </dt>
            <dd className="mt-0.5 font-semibold">
              {cityFocus.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#8A8278]">
              Date & Duration
            </dt>
            <dd className="mt-0.5 font-semibold">
              {dateLabel} · {tourHours}h
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#8A8278]">
              Guests
            </dt>
            <dd className="mt-0.5 font-semibold">{guests}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#8A8278]">
              Guide
            </dt>
            <dd className="mt-0.5 font-semibold">
              {guidePreferenceLabel(guidePreference)} · starts{" "}
              {formatClock12h(startTime || "09:00")}
            </dd>
          </div>
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
                  className="flex justify-between gap-4 border-b border-[#F0EBE3] pb-1.5"
                >
                  <span className="text-zinc-600">
                    STOP {String(stop.stopNumber).padStart(2, "0")} ·{" "}
                    {stop.title}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
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
          <h2 className="font-godiva text-sm uppercase tracking-wider text-[#8A8278]">
            Itemized Breakdown
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {quote.lines.map((line) => (
              <li
                key={line.id}
                className="flex items-start justify-between gap-4 border-b border-[#F0EBE3] pb-2.5"
              >
                <span>{line.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatEur(line.amountEur)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-[#0B1F3A] bg-[#0B1F3A] px-5 py-5 text-white">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/60">
            Estimated Single-Day Package
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            {formatEur(quote.totalEur)}
          </p>
          <p className="mt-1 text-sm text-white/70 tabular-nums">
            ≈ {formatYen(quote.totalYen)}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/55">
            Estimate for planning. Final confirmation may adjust ticket
            availability, guide language, and seasonal surcharges.
          </p>
        </section>

        <p className="mt-8 text-center text-[0.65rem] uppercase tracking-[0.25em] text-[#8A8278]">
          TOKIOTOURS · Single-Day Private Tour
        </p>
      </article>
    </div>
  );
}
