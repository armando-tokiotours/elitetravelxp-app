"use client";

import Link from "next/link";
import { SquarePen } from "lucide-react";
import { BoardingPassCard } from "@/components/builder/BoardingPassCard";
import {
  ItineraryStopTicket,
  resolveItineraryStopKind,
  type ItineraryStopKind,
} from "@/components/dossier/ItineraryStopTickets";
import {
  itineraryStopBadgeLabel,
} from "@/lib/experiencesPlaces";
import {
  formatClock12h,
  type TimedRouteItem,
} from "@/lib/singleDayTimeSlots";
import type { SingleDaySelectedExperience } from "@/store/useSingleDayBuilderStore";
import type { PbTour } from "@/lib/pocketbase/client";

/** Guided tour stop vs activity/entry ticket (paper stub skin). */
export type TimelineStopKind = ItineraryStopKind;

export type TimelineStop = TimedRouteItem<SingleDaySelectedExperience> & {
  thumbUrl?: string;
  description?: string;
  /** Tour route / stop sequence from catalog */
  route?: string;
  address?: string;
  vibeLabel?: string;
  ringTone?: "red" | "cyan";
  stopKind?: TimelineStopKind;
};

function resolveStopKind(
  stop: TimedRouteItem<SingleDaySelectedExperience>,
  item: PbTour | undefined
): TimelineStopKind {
  return resolveItineraryStopKind({
    category: stop.category || item?.category,
    entry_type: stop.entry_type || item?.entry_type,
    access_type: item?.access_type || stop.access_type,
    is_self_guided: item?.is_self_guided,
    is_extra: stop.is_extra,
    title: stop.title || item?.title,
    description: item?.description,
  });
}

function ringToneFromKind(kind: TimelineStopKind): "red" | "cyan" {
  return kind === "tour" ? "red" : "cyan";
}


/** Compact range: "09:00 – 11:00 AM" */
export function formatTimeSlotRange(startHm: string, endHm: string): string {
  const start = formatClock12h(startHm);
  const end = formatClock12h(endHm);
  const startPeriod = start.slice(-2);
  const endPeriod = end.slice(-2);
  if (startPeriod === endPeriod) {
    return `${start.slice(0, -3)} – ${end}`;
  }
  return `${start} – ${end}`;
}

export function enrichTimelineStops(
  timed: TimedRouteItem<SingleDaySelectedExperience>[],
  catalogById: Map<string, PbTour>,
  thumbFor: (tourId: string) => string
): TimelineStop[] {
  return timed.map((stop) => {
    const item = catalogById.get(stop.tourId);
    const desc = String(item?.description || "").trim();
    const route = String(item?.route || "").trim();
    const address =
      typeof item?.google_location?.address === "string"
        ? item.google_location.address.trim()
        : "";
    const stopKind = resolveStopKind(stop, item);
    return {
      ...stop,
      thumbUrl: thumbFor(stop.tourId),
      description: desc
        ? desc.length > 160
          ? `${desc.slice(0, 157)}…`
          : desc
        : undefined,
      route: route || undefined,
      address,
      vibeLabel: itineraryStopBadgeLabel({
        category: stop.category || item?.category,
        entry_type: stop.entry_type || item?.entry_type,
        is_extra: stop.is_extra,
      }),
      ringTone: ringToneFromKind(stopKind),
      stopKind,
    };
  });
}

/**
 * Alternating vertical infographic timeline for Single-Day dossier / print.
 * Desktop: odd stops left, even stops right. Mobile: left-rail stack.
 */
export function SingleDayTimelineInfographic({
  stops,
  startTime,
  endTime,
  totalHours,
  cityLabel,
  meetingPointName,
  meetingPointAddress,
  variant = "screen",
  editHref,
}: {
  stops: TimelineStop[];
  startTime: string;
  endTime: string;
  totalHours: number;
  cityLabel?: string;
  /** Guest-selected hotel / hub from map picker */
  meetingPointName?: string | null;
  meetingPointAddress?: string | null;
  /** screen = dark glass; print = high-contrast light */
  variant?: "screen" | "print";
  /** When set, shows a compact edit control linking to the builder. */
  editHref?: string;
}) {
  const isPrint = variant === "print";
  const hoursLabel = Number.isInteger(totalHours)
    ? `${totalHours}.0`
    : (Math.round(totalHours * 10) / 10).toFixed(1);
  const windowLabel = `${formatClock12h(startTime)} – ${formatClock12h(endTime)} (${hoursLabel} Hours Total)`;

  const placeName = String(meetingPointName || "").trim();
  const placeAddress = String(meetingPointAddress || "").trim();
  const pickupTitle =
    placeName ||
    (placeAddress && placeAddress !== placeName ? placeAddress : "") ||
    "Hotel / Hub Pick-up";
  const dropoffTitle =
    placeName ||
    (placeAddress && placeAddress !== placeName ? placeAddress : "") ||
    "Hotel / Station Drop-off";
  const placeSubtitleHint =
    placeName && placeAddress && placeAddress !== placeName
      ? placeAddress
      : null;
  const routeHint = placeName
    ? `${cityLabel || "Tokyo"} · ${placeName}`
    : cityLabel
      ? `${cityLabel} · Hotel / Hub pick-up & drop-off`
      : "Hotel / Hub pick-up & drop-off";

  if (stops.length === 0) {
    return (
      <div
        className={
          isPrint
            ? "rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500"
            : "rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500"
        }
      >
        No experiences scheduled yet. Continue editing to add stops.
      </div>
    );
  }

  return (
    <div
      className={`sd-timeline print:break-inside-avoid px-8 sm:px-10 ${
        isPrint
          ? "sd-timeline--print text-white"
          : "text-slate-900 print:text-black"
      }`}
    >
      <header className="mb-5 md:mb-8">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-dotted border-slate-300 pb-2">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.35em] text-[#075473] print:text-gray-900">
            Day Timeline
          </p>
          {editHref && !isPrint ? (
            <Link
              href={editHref}
              aria-label="Edit Itinerary"
              title="Edit Itinerary"
              className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:text-[#D91147] print:hidden"
            >
              <SquarePen className="h-[18px] w-[18px]" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
        <p className="mt-2 font-mono text-sm font-bold tracking-wide text-slate-900 print:text-gray-900 sm:text-base">
          {windowLabel}
        </p>
        {cityLabel || placeName ? (
          <p
            className={`mt-1 text-xs ${
              isPrint ? "text-white/60" : "text-slate-500"
            }`}
          >
            {routeHint}
          </p>
        ) : null}
      </header>

      <BoardingPassCard
        kind="arrival"
        compact
        headerMain="Pick-up Pass"
        headerStub="Start"
        title={pickupTitle}
        subtitle={
          placeSubtitleHint
            ? placeSubtitleHint
            : cityLabel
              ? `${cityLabel} · Private day tour begins`
              : "Private day tour begins"
        }
        dateLabel={formatClock12h(startTime)}
        hubCode={cityHubCode(cityLabel)}
        stubTopLabel="Time"
        stubBottomLabel="City"
        className="mb-4"
      />

      <ol className="sd-timeline-track relative mx-auto max-w-3xl list-none pl-0">
        <div
          aria-hidden
          className={`sd-timeline-line pointer-events-none absolute top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-cyan-400/30 to-amber-500/50 ${
            isPrint
              ? "left-4 bg-[#075473] md:left-1/2 md:-translate-x-px"
              : "left-4 shadow-[0_0_12px_rgba(34,211,238,0.35)] md:left-1/2 md:-translate-x-px"
          }`}
        />

        {stops.map((stop) => {
          const branchLeft = stop.stopNumber % 2 === 1;
          const routeText = String(stop.route || "").trim();

          return (
            <li
              key={`${stop.tourId}-${stop.stopNumber}`}
              className={`sd-timeline-item relative mb-10 last:mb-0 md:mb-14 ${
                branchLeft
                  ? "md:pr-[calc(50%+1.75rem)]"
                  : "md:pl-[calc(50%+1.75rem)]"
              }`}
            >
              {/* Rail node — no circular stop photo */}
              <div
                aria-hidden
                className={`absolute top-3 left-0 z-[2] h-2.5 w-2.5 rounded-full md:left-1/2 md:-translate-x-1/2 ${
                  isPrint ? "bg-[#075473]" : "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                }`}
              />

              {/* Opposite-side route text (desktop) */}
              {routeText ? (
                <div
                  className={`pointer-events-none absolute top-8 hidden max-w-[calc(50%-2rem)] md:block ${
                    branchLeft
                      ? "left-[calc(50%+1.75rem)] pr-8 text-left sm:pr-12"
                      : "right-[calc(50%+1.75rem)] pl-8 text-right sm:pl-12"
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                      isPrint ? "text-[#075473]" : "text-cyan-400/80"
                    }`}
                  >
                    Route
                  </p>
                  <p
                    className={`mt-1 whitespace-pre-line text-xs leading-relaxed ${
                      isPrint ? "text-zinc-600" : "text-slate-600"
                    }`}
                  >
                    {routeText}
                  </p>
                </div>
              ) : null}

              <div
                className={`sd-timeline-card pl-6 md:pl-0 ${
                  branchLeft ? "md:text-right" : "md:text-left"
                }`}
              >
                <p
                  className={`mb-2 font-mono text-xs font-bold tracking-wide sm:text-sm ${
                    isPrint ? "text-[#B45309]" : "text-[#075473]"
                  }`}
                >
                  {formatTimeSlotRange(stop.startTime, stop.endTime)}
                </p>

                <ItineraryStopTicket
                  kind={stop.stopKind || "tour"}
                  title={stop.title}
                  stopNumber={stop.stopNumber}
                  durationHours={Number(stop.duration_hours) || 0}
                  vibeLabel={stop.vibeLabel}
                  address={stop.address}
                  routeText={routeText}
                  thumbUrl={stop.thumbUrl}
                  branchLeft={branchLeft}
                  isPrint={isPrint}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <BoardingPassCard
        kind="departure"
        compact
        headerMain="Drop-off Pass"
        headerStub="End"
        title={dropoffTitle}
        subtitle={
          placeSubtitleHint
            ? placeSubtitleHint
            : cityLabel
              ? `${cityLabel} · Private day tour ends`
              : "Private day tour ends"
        }
        dateLabel={formatClock12h(endTime)}
        hubCode={cityHubCode(cityLabel)}
        stubTopLabel="Time"
        stubBottomLabel="City"
        className="mt-4"
      />
    </div>
  );
}

function cityHubCode(cityLabel?: string): string {
  const raw = (cityLabel || "").trim();
  if (!raw) return "HUB";
  const first = raw.split(/[·,/]/)[0]?.trim() || raw;
  if (first.length <= 4) return first.toUpperCase();
  return first.slice(0, 3).toUpperCase();
}
