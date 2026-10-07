"use client";

import { MapPin } from "lucide-react";
import { experienceNeedsEntryTicket } from "@/lib/accessType";

export type ItineraryStopKind = "tour" | "activity" | "ticket";

export type ItineraryStopTicketProps = {
  kind: ItineraryStopKind;
  title: string;
  stopNumber?: number;
  durationHours?: number;
  vibeLabel?: string;
  address?: string;
  routeText?: string;
  thumbUrl?: string;
  /** Align like Single timeline branches */
  branchLeft?: boolean;
  isPrint?: boolean;
  className?: string;
};

export function resolveItineraryStopKind(input: {
  category?: string | null;
  access_type?: string | null;
  is_self_guided?: boolean | null;
  is_extra?: boolean | null;
  title?: string | null;
  description?: string | null;
}): ItineraryStopKind {
  const category = String(input.category || "").toLowerCase();
  if (
    experienceNeedsEntryTicket({
      title: input.title,
      description: input.description,
      access_type: input.access_type,
      is_self_guided: input.is_self_guided,
      category: input.category,
    })
  ) {
    return "ticket";
  }
  if (category === "activity" || input.is_extra) return "activity";
  return "tour";
}

function padStop(n: number | undefined): string {
  const v = Number(n) || 0;
  return String(Math.max(0, v)).padStart(2, "0");
}

/** Stub duration: "02 hours" / "1.5 hours" */
export function stubDurationLabel(hours: number | undefined): string {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return "—";
  if (Number.isInteger(h)) {
    return `${String(h).padStart(2, "0")} hours`;
  }
  return `${h} hours`;
}

function durationPillLabel(hours: number | undefined): string {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return "—";
  if (Number.isInteger(h)) {
    return `${h} Hour${h === 1 ? "" : "s"}`;
  }
  return `${h} Hours`;
}

/** Unified entry — tour = dark Stop Pass; activity/ticket = light paper. */
export function ItineraryStopTicket(props: ItineraryStopTicketProps) {
  if (props.kind === "tour") {
    return <TourStopPassCard {...props} />;
  }
  return <PaperActivityTicketCard {...props} />;
}

/** Light perforated paper — activities & entry tickets. */
export function PaperActivityTicketCard({
  kind,
  title,
  stopNumber = 0,
  durationHours,
  vibeLabel,
  address,
  routeText,
  thumbUrl,
  branchLeft = false,
  isPrint = false,
  className = "",
}: ItineraryStopTicketProps) {
  const isTicket = kind === "ticket";
  const kindLabel = isTicket ? "Entry ticket" : "Activity";
  const stopNo = padStop(stopNumber);
  const pageBg = isPrint ? "bg-white" : "bg-[#0A0E14]";

  return (
    <section
      className={`relative w-full overflow-visible ${branchLeft ? "md:ml-auto" : ""} ${className}`}
    >
      <div
        className={`pointer-events-none absolute top-2 bottom-2 -left-1.5 z-[2] flex w-3 flex-col justify-evenly ${pageBg}`}
        aria-hidden
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${pageBg}`} />
        ))}
      </div>

      <div
        className="relative flex min-h-[6.25rem] overflow-hidden rounded-xl border border-black/10 bg-[#E8E8EA] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #F7F7F8 0%, #E6E6E8 100%)",
        }}
      >
        <div
          className="relative flex w-5 shrink-0 flex-col items-center justify-evenly py-2"
          aria-hidden
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full border border-black/10 ${
                isPrint ? "bg-white" : "bg-[#0A0E14]"
              }`}
            />
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between px-2 py-2.5 sm:px-3">
          <div
            className={`rounded-lg border border-black/8 bg-white px-3 py-2.5 shadow-inner ${
              branchLeft ? "md:text-right" : ""
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#054F70]">
              {kindLabel}
            </p>
            <h4 className="mt-1 font-godiva text-base uppercase tracking-wider text-[#0B1F3A] sm:text-lg">
              {title}
            </h4>
            <div
              className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 ${
                branchLeft ? "md:justify-end" : ""
              }`}
            >
              {vibeLabel ? (
                <span className="text-[#E60F43]/80">{vibeLabel}</span>
              ) : null}
            </div>
            {address ? (
              <p
                className={`mt-1.5 inline-flex items-start gap-1 text-[10px] text-zinc-400 ${
                  branchLeft ? "md:flex-row-reverse" : ""
                }`}
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="normal-case tracking-normal">{address}</span>
              </p>
            ) : null}
            {routeText ? (
              <p className="mt-1.5 whitespace-pre-line text-[10px] leading-relaxed text-zinc-400 md:hidden">
                {routeText}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative flex w-[4.75rem] shrink-0 flex-col items-center justify-between border-l border-dashed border-zinc-400/70 px-2 py-2.5 sm:w-[5.5rem]">
          <span
            className={`pointer-events-none absolute -top-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full ${
              isPrint ? "bg-white" : "bg-[#0A0E14]"
            }`}
            aria-hidden
          />
          <span
            className={`pointer-events-none absolute -bottom-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full ${
              isPrint ? "bg-white" : "bg-[#0A0E14]"
            }`}
            aria-hidden
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Stop {stopNo}
          </p>
          <div className="relative h-12 w-12 overflow-hidden rounded-sm bg-zinc-200 shadow-sm sm:h-14 sm:w-14">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="grid h-full w-full grid-cols-5 gap-px bg-white p-1"
                aria-hidden
              >
                {Array.from({ length: 25 }).map((_, i) => {
                  const on = ((i * 7 + (stopNumber || 0)) % 25) % 3 === 0;
                  return (
                    <span
                      key={i}
                      className={`rounded-[1px] ${on ? "bg-[#0B1F3A]" : "bg-transparent"}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-center font-mono text-[9px] font-bold leading-tight tracking-wide text-[#054F70]">
            {stubDurationLabel(durationHours)}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Dark Stop Pass — guided tours; crimson header + photo under title. */
export function TourStopPassCard({
  title,
  stopNumber = 0,
  durationHours,
  vibeLabel,
  address,
  routeText,
  thumbUrl,
  branchLeft = false,
  isPrint = false,
  className = "",
}: ItineraryStopTicketProps) {
  const stopNo = padStop(stopNumber);
  const notch = isPrint ? "bg-white" : "bg-[#05080C]";

  return (
    <section
      className={`relative w-full overflow-hidden rounded-2xl border text-white shadow-2xl ${
        isPrint
          ? "border-zinc-300 bg-white text-[#0B1F3A]"
          : "border-white/10 bg-[#0A1017]"
      } ${branchLeft ? "md:ml-auto" : ""} ${className}`}
    >
      <div className="flex bg-[#D91147] text-white">
        <div className="flex min-w-0 flex-1 items-center px-3 py-1.5 sm:px-4">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.24em] text-white">
            Stop Pass
          </p>
        </div>
        <div className="relative flex w-[4.25rem] shrink-0 items-center justify-center border-l border-dashed border-white/40 px-1.5 sm:w-24">
          <span
            className={`pointer-events-none absolute -top-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full ${notch}`}
            aria-hidden
          />
          <p className="font-mono text-[0.55rem] font-bold tracking-wider text-white">
            {stopNo}
          </p>
        </div>
      </div>

      <div className="flex min-h-[5.5rem]">
        <div className="relative flex min-w-0 flex-1 flex-col justify-between overflow-hidden px-3 py-3 sm:px-4">
          {thumbUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25"
                aria-hidden
              />
            </>
          ) : null}
          <div className={`relative z-10 ${branchLeft ? "md:text-right" : ""}`}>
            <h4
              className={`font-godiva text-base uppercase tracking-wider sm:text-lg ${
                isPrint && !thumbUrl ? "text-[#0B1F3A]" : "text-white"
              }`}
            >
              {title}
            </h4>
            {address ? (
              <p
                className={`mt-1.5 inline-flex items-start gap-1 text-[11px] ${
                  thumbUrl || !isPrint ? "text-white/70" : "text-zinc-500"
                } ${branchLeft ? "md:flex-row-reverse" : ""}`}
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{address}</span>
              </p>
            ) : null}
            {routeText ? (
              <p
                className={`mt-2 whitespace-pre-line text-[11px] leading-relaxed md:hidden ${
                  thumbUrl || !isPrint ? "text-white/60" : "text-zinc-500"
                }`}
              >
                <span className="font-bold uppercase tracking-wider text-cyan-300/90">
                  Route ·{" "}
                </span>
                {routeText}
              </p>
            ) : null}
          </div>
          <div
            className={`relative z-10 mt-3 flex flex-wrap gap-1.5 ${
              branchLeft ? "md:justify-end" : ""
            }`}
          >
            {vibeLabel ? (
              <span className="rounded-full bg-[#E60F43]/90 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                {vibeLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={`relative flex w-[4.25rem] shrink-0 flex-col justify-between border-l border-dashed px-2 py-3 sm:w-24 sm:px-2.5 ${
            isPrint ? "border-zinc-300" : "border-white/35"
          }`}
        >
          <span
            className={`pointer-events-none absolute -top-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full ${notch}`}
            aria-hidden
          />
          <span
            className={`pointer-events-none absolute -bottom-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full ${notch}`}
            aria-hidden
          />
          <div className="space-y-1">
            <p
              className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${
                isPrint ? "text-zinc-400" : "text-white/45"
              }`}
            >
              Time
            </p>
            <p
              className={`text-[10px] font-bold uppercase leading-tight ${
                isPrint ? "text-[#0B1F3A]" : "text-white"
              }`}
            >
              {durationPillLabel(durationHours)}
            </p>
            <p
              className={`pt-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] ${
                isPrint ? "text-zinc-400" : "text-white/45"
              }`}
            >
              Stop
            </p>
            <p className="font-mono text-sm font-bold tracking-wider text-[#F6A724]">
              {stopNo}
            </p>
          </div>
          <div
            className="mt-2 flex h-6 items-end gap-px overflow-hidden"
            aria-hidden
          >
            {[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 2, 1].map((w, i) => (
              <span
                key={i}
                className={`shrink-0 ${isPrint ? "bg-[#0B1F3A]" : "bg-white"}`}
                style={{
                  width: w,
                  height: `${55 + (i % 5) * 9}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
