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
}: {
  variant: "multi" | "single";
  children: ReactNode;
  className?: string;
}) {
  const row = useTimelineMascotLayout(variant);
  const justify = alignToJustify(row.align);

  return (
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
          <TimelineProgressMascot className="-mb-4 sm:-mb-5" />
        </div>
      </div>
      <div
        className="shrink-0 overflow-visible"
        style={{ width: `${row.gapAfterPct}%` }}
        aria-hidden
      />
    </div>
  );
}
