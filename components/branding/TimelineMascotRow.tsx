"use client";

import type { ReactNode } from "react";
import { TimelineProgressMascot } from "@/components/branding/TimelineProgressMascot";
import { useTimelineMascotLayout } from "@/hooks/useTimelineMascotLayout";
import { alignToJustify } from "@/lib/timelineMascotLayout";

/**
 * Progress track + mascot slot driven by Team Access layout %.
 */
export function TimelineMascotRow({
  variant,
  children,
  className = "",
  centerSlot,
  trailingSlot,
}: {
  variant: "multi" | "single";
  children: ReactNode;
  className?: string;
  /** Title centred on the exact same line as the guest name, at all widths. */
  centerSlot?: ReactNode;
  /** Control rendered immediately to the left of the mascot (e.g. restart), in the gap after the progress/DRAFT area. */
  trailingSlot?: ReactNode;
}) {
  const row = useTimelineMascotLayout(variant);
  const justify = alignToJustify(row.align);
  // Mascot column is visually nudged left by nudgePct% of its own width;
  // compensate so the leading restart's right edge stays left of the
  // mascot's visual left edge (and the mascot keeps its original x).
  const nudgeShiftPctOfRow =
    row.nudgePct < 0 ? Math.abs(row.nudgePct * row.mascotPct) / 100 : 0;

  return (
    <div className="relative">
      {centerSlot ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex h-9 min-w-0 max-w-[48%] items-center justify-center text-center sm:max-w-[60%]">
          {centerSlot}
        </div>
      ) : null}
      <div
        className={`relative mx-auto flex max-w-3xl items-start overflow-visible ${className}`}
      >
      <nav
        className="min-w-0"
        style={{ width: `${row.barPct}%` }}
        aria-label={
          variant === "multi"
            ? "Trip builder progress"
            : "Single-day builder progress"
        }
      >
        {children}
      </nav>
      <div
        className="shrink-0 overflow-visible"
        style={{ width: `${row.gapBeforePct}%` }}
        aria-hidden
      />
      {trailingSlot ? (
        <div
          className="flex shrink-0 translate-x-1 translate-y-3 items-center self-center pr-0.5"
          style={
            nudgeShiftPctOfRow > 0
              ? { marginRight: `${nudgeShiftPctOfRow}%` }
              : undefined
          }
        >
          {trailingSlot}
        </div>
      ) : null}
      <div
        className="flex shrink-0 items-end overflow-visible pt-0.5"
        style={{
          width: `${row.mascotPct}%`,
          justifyContent: justify,
          transform:
            row.nudgePct !== 0 ? `translateX(${row.nudgePct}%)` : undefined,
        }}
      >
        <div
          className="overflow-visible"
          style={{
            transform:
              row.scalePct !== 100 ? `scale(${row.scalePct / 100})` : undefined,
            transformOrigin: "bottom left",
          }}
        >
          <TimelineProgressMascot className="-mb-4 translate-y-4 sm:-mb-5" />
        </div>
      </div>
      <div
        className="shrink-0 overflow-visible"
        style={{ width: `${row.gapAfterPct}%` }}
        aria-hidden
      />
      </div>
    </div>
  );
}
