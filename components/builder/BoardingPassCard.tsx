"use client";

import { PlaneLanding, PlaneTakeoff, Ship } from "lucide-react";

export type BoardingPassKind = "arrival" | "departure";
export type BoardingPassHubMode = "airport" | "cruise";

type BoardingPassCardProps = {
  kind: BoardingPassKind;
  title: string;
  subtitle: string;
  /** Stub top value (date or time) */
  dateLabel: string;
  /** Stub bottom code (hub / city) */
  hubCode: string;
  /** Airport (plane) vs cruise port (ship) */
  hubMode?: BoardingPassHubMode;
  /** Optional stub field labels */
  stubTopLabel?: string;
  stubBottomLabel?: string;
  /** Optional header override (defaults: Arrival/Departure Pass) */
  headerMain?: string;
  headerStub?: string;
  /**
   * Compact (~40% smaller) — Pick-up / Drop-off / Arrival / Departure
   * are logistics we don't control; keep visual weight below stop passes.
   */
  compact?: boolean;
  className?: string;
};

const BARCODE = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 1];

/**
 * Boarding-pass style ticket — Arrival / Departure (M) or Pick-up / Drop-off (S).
 */
export function BoardingPassCard({
  kind,
  title,
  subtitle,
  dateLabel,
  hubCode,
  hubMode = "airport",
  stubTopLabel = "Date",
  stubBottomLabel = "Hub",
  headerMain,
  headerStub,
  compact = false,
  className = "",
}: BoardingPassCardProps) {
  const isPort = hubMode === "cruise";
  const Icon = isPort
    ? Ship
    : kind === "arrival"
      ? PlaneLanding
      : PlaneTakeoff;
  const main =
    headerMain ??
    (kind === "arrival" ? "Arrival Pass" : "Departure Pass");
  const stub =
    headerStub ??
    (isPort
      ? kind === "arrival"
        ? "Port"
        : "Sail"
      : kind === "arrival"
        ? "Landing"
        : "Takeoff");

  if (compact) {
    return (
      <section
        className={`relative mx-auto w-full max-w-[min(100%,20.5rem)] overflow-hidden rounded-xl border border-white/10 bg-[#0A1017]/90 text-white shadow-md opacity-90 sm:max-w-[22rem] ${className}`}
      >
        <div className="flex bg-[#EBFFFF]/90 text-[#054F70]">
          <div className="flex min-w-0 flex-1 items-center px-2 py-1">
            <p className="text-[0.5rem] font-bold uppercase tracking-[0.22em] text-[#054F70]">
              {main}
            </p>
          </div>
          <div className="relative flex w-14 shrink-0 items-center justify-center border-l border-dashed border-[#054F70]/35 px-1">
            <span
              className="pointer-events-none absolute -left-1 -top-1 z-[1] h-2 w-2 rounded-full bg-[#05080C]"
              aria-hidden
            />
            <p className="text-[0.45rem] font-bold uppercase tracking-[0.14em] text-[#054F70]">
              {stub}
            </p>
          </div>
        </div>

        <div className="flex min-h-[4.5rem]">
          <div className="flex w-6 shrink-0 flex-col items-center gap-1 border-r border-white/10 py-2">
            <Icon className="h-3 w-3 text-white/80" aria-hidden />
            <div className="flex flex-col gap-[2px]" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="h-px w-2.5 bg-white/30" />
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between px-2 py-2">
            <div>
              <p className="line-clamp-2 text-[11px] font-bold uppercase leading-snug tracking-wide">
                {title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[8px] uppercase leading-snug tracking-wide text-white/45">
                {subtitle}
              </p>
            </div>
            <div className="mt-1.5 h-px w-full bg-white/15" />
          </div>

          <div className="relative flex w-14 shrink-0 flex-col justify-between border-l border-dashed border-white/30 px-1.5 py-1.5">
            <span
              className="pointer-events-none absolute -left-1 -top-1 z-[1] h-2 w-2 rounded-full bg-[#05080C]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -bottom-1 -left-1 z-[1] h-2 w-2 rounded-full bg-[#05080C]"
              aria-hidden
            />
            <div className="space-y-0.5">
              <p className="text-[7px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {stubTopLabel}
              </p>
              <p className="text-[8px] font-bold uppercase leading-tight">
                {dateLabel}
              </p>
              <p className="pt-0.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {stubBottomLabel}
              </p>
              <p className="font-mono text-[11px] font-bold tracking-wider text-[#F6A724]">
                {hubCode}
              </p>
            </div>
            <div
              className="mt-1 flex h-4 items-end gap-px overflow-hidden"
              aria-hidden
            >
              {BARCODE.map((w, i) => (
                <span
                  key={i}
                  className="shrink-0 bg-white/90"
                  style={{
                    width: Math.max(1, Math.round(w * 0.6)),
                    height: `${50 + (i % 5) * 8}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017] text-white shadow-2xl ${className}`}
    >
      <div className="flex bg-[#EBFFFF] text-[#054F70]">
        <div className="flex min-w-0 flex-1 items-center px-3 py-2 sm:px-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[#054F70]">
            {main}
          </p>
        </div>
        <div className="relative flex w-[4.75rem] shrink-0 items-center justify-center border-l border-dashed border-[#054F70]/35 px-2 sm:w-28">
          <span
            className="pointer-events-none absolute -left-1.5 -top-1.5 z-[1] h-3 w-3 rounded-full bg-[#05080C]"
            aria-hidden
          />
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#054F70]">
            {stub}
          </p>
        </div>
      </div>

      <div className="flex min-h-[7.5rem]">
        <div className="flex w-9 shrink-0 flex-col items-center gap-2 border-r border-white/10 py-3.5 sm:w-11">
          <Icon className="h-4 w-4 text-white" aria-hidden />
          <div className="flex flex-col gap-[3px]" aria-hidden>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="h-px w-3.5 bg-white/35 sm:w-4" />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-3.5 sm:px-4">
          <div>
            <p className="text-base font-bold uppercase leading-snug tracking-wide sm:text-lg">
              {title}
            </p>
            <p className="mt-1.5 text-[11px] uppercase leading-relaxed tracking-wide text-white/55 sm:text-xs">
              {subtitle}
            </p>
          </div>
          <div className="mt-3 h-px w-full bg-white/20" />
        </div>

        <div className="relative flex w-[4.75rem] shrink-0 flex-col justify-between border-l border-dashed border-white/35 px-2 py-3 sm:w-28 sm:px-2.5">
          <span
            className="pointer-events-none absolute -left-1.5 -top-1.5 z-[1] h-3 w-3 rounded-full bg-[#05080C]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-1.5 -left-1.5 z-[1] h-3 w-3 rounded-full bg-[#05080C]"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {stubTopLabel}
            </p>
            <p className="text-[10px] font-bold uppercase leading-tight sm:text-[11px]">
              {dateLabel}
            </p>
            <p className="pt-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {stubBottomLabel}
            </p>
            <p className="font-mono text-sm font-bold tracking-wider text-[#F6A724]">
              {hubCode}
            </p>
          </div>
          <div
            className="mt-2 flex h-7 items-end gap-px overflow-hidden"
            aria-hidden
          >
            {BARCODE.map((w, i) => (
              <span
                key={i}
                className="shrink-0 bg-white"
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
