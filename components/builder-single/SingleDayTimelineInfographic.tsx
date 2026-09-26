"use client";

import { MapPin } from "lucide-react";
import { BoardingPassCard } from "@/components/builder/BoardingPassCard";
import { QUIZ_VIBE } from "@/lib/experienceProfiler";
import { formatDurationBadge } from "@/lib/experiencesPlaces";
import {
  formatClock12h,
  type TimedRouteItem,
} from "@/lib/singleDayTimeSlots";
import type { SingleDaySelectedExperience } from "@/store/useSingleDayBuilderStore";
import type { PbTour } from "@/lib/pocketbase/client";

export type TimelineStop = TimedRouteItem<SingleDaySelectedExperience> & {
  thumbUrl?: string;
  description?: string;
  address?: string;
  vibeLabel?: string;
  ringTone?: "red" | "cyan";
};

function vibeLabelFromTags(tags: string[] | undefined): string {
  if (!tags?.length) return "Experience";
  const first = String(tags[0] || "").toLowerCase();
  const known = QUIZ_VIBE.find((o) => o.id === first);
  if (known) return known.label;
  if (first.includes("food") || first.includes("night")) return "Food & Nightlife";
  if (first.includes("modern") || first.includes("art"))
    return "Modern & Pop Culture";
  if (first.includes("nature")) return "Nature & Scenery";
  if (first.includes("culture") || first.includes("heritage"))
    return "Culture & Heritage";
  return tags[0] || "Experience";
}

function ringToneFromTags(tags: string[] | undefined): "red" | "cyan" {
  const first = String(tags?.[0] || "").toLowerCase();
  if (
    first.includes("culture") ||
    first.includes("heritage") ||
    first.includes("nature")
  ) {
    return "red";
  }
  return "cyan";
}

function durationPillLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (Number.isInteger(hours)) {
    return `${hours} Hour${hours === 1 ? "" : "s"}`;
  }
  const badge = formatDurationBadge(hours).replace(/h$/i, "");
  return `${badge} Hours`;
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
    const tags = item?.vibe_tags;
    const desc = String(item?.description || "").trim();
    const address =
      typeof item?.google_location?.address === "string"
        ? item.google_location.address.trim()
        : "";
    return {
      ...stop,
      thumbUrl: thumbFor(stop.tourId),
      description: desc
        ? desc.length > 160
          ? `${desc.slice(0, 157)}…`
          : desc
        : undefined,
      address,
      vibeLabel: vibeLabelFromTags(tags),
      ringTone: ringToneFromTags(tags),
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
  variant = "screen",
}: {
  stops: TimelineStop[];
  startTime: string;
  endTime: string;
  totalHours: number;
  cityLabel?: string;
  /** screen = dark glass; print = high-contrast light */
  variant?: "screen" | "print";
}) {
  const isPrint = variant === "print";
  const hoursLabel = Number.isInteger(totalHours)
    ? `${totalHours}.0`
    : (Math.round(totalHours * 10) / 10).toFixed(1);
  const windowLabel = `${formatClock12h(startTime)} – ${formatClock12h(endTime)} (${hoursLabel} Hours Total)`;

  if (stops.length === 0) {
    return (
      <div
        className={
          isPrint
            ? "rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500"
            : "rounded-2xl border border-dashed border-white/15 bg-[#0D1117]/60 px-4 py-8 text-center text-sm text-white/50"
        }
      >
        No experiences scheduled yet. Continue editing to add stops.
      </div>
    );
  }

  return (
    <div
      className={`sd-timeline ${
        isPrint
          ? "sd-timeline--print text-[#0B1F3A]"
          : "rounded-3xl border border-white/10 bg-[#0A0E14] p-4 text-white shadow-[0_0_40px_rgba(7,84,115,0.15)] sm:p-6 md:p-8"
      }`}
    >
      <header className="mb-6 text-center md:mb-10">
        <p
          className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${
            isPrint ? "text-[#075473]" : "text-cyan-400/80"
          }`}
        >
          Day Timeline
        </p>
        <p
          className={`mt-2 font-mono text-sm font-bold tracking-wide sm:text-base ${
            isPrint ? "text-[#0B1F3A]" : "text-[#F6A724]"
          }`}
        >
          {windowLabel}
        </p>
        {cityLabel ? (
          <p
            className={`mt-1 text-xs ${
              isPrint ? "text-zinc-500" : "text-white/45"
            }`}
          >
            {cityLabel} · Hotel / Hub pick-up & drop-off
          </p>
        ) : null}
      </header>

      <BoardingPassCard
        kind="arrival"
        headerMain="Pick-up Pass"
        headerStub="Start"
        title="Hotel / Hub Pick-up"
        subtitle={
          cityLabel
            ? `${cityLabel} · Private day tour begins`
            : "Private day tour begins"
        }
        dateLabel={formatClock12h(startTime)}
        hubCode={cityHubCode(cityLabel)}
        stubTopLabel="Time"
        stubBottomLabel="City"
        className="mb-6"
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
          const ring =
            stop.ringTone === "red"
              ? isPrint
                ? "ring-[#E60F43]"
                : "ring-[#E60F43] shadow-[0_0_18px_rgba(230,15,67,0.45)]"
              : isPrint
                ? "ring-[#075473]"
                : "ring-[#075473] shadow-[0_0_18px_rgba(7,84,115,0.55)]";

          return (
            <li
              key={`${stop.tourId}-${stop.stopNumber}`}
              className={`sd-timeline-item relative mb-10 last:mb-0 md:mb-14 pl-12 ${
                branchLeft
                  ? "md:pl-0 md:pr-[calc(50%+1.75rem)]"
                  : "md:pl-[calc(50%+1.75rem)]"
              }`}
            >
              <div className="absolute top-0 left-0 z-[2] md:left-1/2 md:-translate-x-1/2">
                <div
                  className={`relative h-14 w-14 overflow-hidden rounded-full ring-2 sm:h-16 sm:w-16 ${ring} ${
                    isPrint ? "bg-zinc-100" : "bg-[#121212]"
                  }`}
                >
                  {stop.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stop.thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center text-[10px] font-bold ${
                        isPrint ? "text-zinc-500" : "text-white/40"
                      }`}
                    >
                      {String(stop.stopNumber).padStart(2, "0")}
                    </span>
                  )}
                  <span
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${
                      isPrint
                        ? "bg-[#0B1F3A] text-white"
                        : "bg-[#E60F43] text-white shadow-md"
                    }`}
                  >
                    STOP {String(stop.stopNumber).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div
                className={`sd-timeline-card ${
                  branchLeft ? "md:text-right" : "md:text-left"
                }`}
              >
                <p
                  className={`font-mono text-xs font-bold tracking-wide sm:text-sm ${
                    isPrint ? "text-[#B45309]" : "text-[#F6A724]"
                  }`}
                >
                  {formatTimeSlotRange(stop.startTime, stop.endTime)}
                </p>

                <div
                  className={`mt-2 rounded-2xl border p-3.5 sm:p-4 ${
                    isPrint
                      ? "border-zinc-300 bg-white"
                      : "border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
                  } ${branchLeft ? "md:ml-auto" : ""}`}
                >
                  <h4
                    className={`font-godiva text-base uppercase tracking-wider sm:text-lg ${
                      isPrint ? "text-[#0B1F3A]" : "text-white"
                    }`}
                  >
                    {stop.title}
                  </h4>
                  {stop.description ? (
                    <p
                      className={`mt-1.5 text-xs leading-relaxed sm:text-sm ${
                        isPrint ? "text-zinc-600" : "text-white/60"
                      }`}
                    >
                      {stop.description}
                    </p>
                  ) : null}
                  {stop.address ? (
                    <p
                      className={`mt-2 inline-flex items-start gap-1 text-[11px] ${
                        isPrint ? "text-zinc-500" : "text-white/40"
                      } ${branchLeft ? "md:flex-row-reverse" : ""}`}
                    >
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{stop.address}</span>
                    </p>
                  ) : null}
                  <div
                    className={`mt-3 flex flex-wrap gap-1.5 ${
                      branchLeft ? "md:justify-end" : ""
                    }`}
                  >
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        isPrint
                          ? "bg-zinc-100 text-[#075473]"
                          : "bg-cyan-500/15 text-cyan-300"
                      }`}
                    >
                      {durationPillLabel(Number(stop.duration_hours) || 0)}
                    </span>
                    {stop.vibeLabel ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          isPrint
                            ? "bg-[#E60F43]/10 text-[#E60F43]"
                            : "bg-[#E60F43]/15 text-[#F29727]"
                        }`}
                      >
                        {stop.vibeLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <BoardingPassCard
        kind="departure"
        headerMain="Drop-off Pass"
        headerStub="End"
        title="Hotel / Station Drop-off"
        subtitle={
          cityLabel
            ? `${cityLabel} · Private day tour ends`
            : "Private day tour ends"
        }
        dateLabel={formatClock12h(endTime)}
        hubCode={cityHubCode(cityLabel)}
        stubTopLabel="Time"
        stubBottomLabel="City"
        className="mt-6"
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
