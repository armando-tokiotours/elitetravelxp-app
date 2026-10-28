"use client";

import { Clock } from "lucide-react";
import {
  CLUSTER_DAY_MAX_HOURS,
  formatDurationBadge,
} from "@/lib/experiencesPlaces";

export type GuideTimeMeterProps = {
  usedGuideHours: number;
  tourHours: number;
  stopCount: number;
  extraHours?: number;
  /** Compact spacing for tight widgets / dense modals. */
  dense?: boolean;
  /** When true, blocks all pointer interaction (builder Status Overview). */
  readOnly?: boolean;
  className?: string;
  /** Hide the explanatory helper line (e.g. ultra-tight slots). */
  hideHelper?: boolean;
};

/**
 * Informative Guide: Nh / cap meter + gradient bar + stop count.
 * Presentational only — selection edits live in Tours & Experiences.
 */
export function GuideTimeMeter({
  usedGuideHours,
  tourHours,
  stopCount,
  extraHours = 0,
  dense = false,
  readOnly = false,
  className = "",
  hideHelper = false,
}: GuideTimeMeterProps) {
  const overBudget = usedGuideHours > tourHours + 0.01;
  const budgetPct = Math.min(
    100,
    tourHours > 0 ? (usedGuideHours / tourHours) * 100 : 0
  );

  return (
    <div
      className={`space-y-2 ${readOnly ? "pointer-events-none select-none" : ""} ${className}`}
      role={readOnly ? "status" : undefined}
      aria-label={
        readOnly
          ? `Guide ${formatDurationBadge(usedGuideHours)} of ${formatDurationBadge(tourHours)}, ${stopCount} stop${stopCount === 1 ? "" : "s"}`
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`flex flex-wrap items-center gap-1.5 text-white/70 ${
            dense ? "text-[11px]" : "text-xs"
          }`}
        >
          <Clock
            className={`${dense ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 text-[#F6A724]`}
            aria-hidden
          />
          Guide:{" "}
          <span
            className={`font-semibold ${
              overBudget ? "text-[#E60F43]" : "text-white"
            }`}
          >
            {formatDurationBadge(usedGuideHours)}
          </span>
          <span className="text-white/40">/</span>
          <span className="font-semibold text-white">
            {formatDurationBadge(tourHours)}
          </span>
          {extraHours > 0 ? (
            <span className="text-white/45">
              · +{formatDurationBadge(extraHours)} extra
            </span>
          ) : null}
        </p>
        <span
          className={`shrink-0 font-medium uppercase tracking-wider text-white/40 ${
            dense ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {stopCount} stop{stopCount === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-white/10 ${
          dense ? "h-1" : "h-1.5"
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            overBudget
              ? "bg-[#E60F43]"
              : "bg-gradient-to-r from-[#054F70] via-[#1BA58A] to-[#E60F43]"
          }`}
          style={{ width: `${budgetPct}%` }}
        />
      </div>
      {hideHelper ? null : (
        <p className={`text-white/35 ${dense ? "text-[9px] leading-snug" : "text-[10px]"}`}>
          One Guided Tour fills the guide meter (selecting another replaces it) ·
          Experiences &amp; Tickets are add-ons outside guide hours · Areas use
          the free {CLUSTER_DAY_MAX_HOURS}h day meter.
        </p>
      )}
    </div>
  );
}
