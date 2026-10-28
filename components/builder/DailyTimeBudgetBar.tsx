"use client";

import {
  CLUSTER_DAY_MAX_HOURS,
  CLUSTER_DEFAULT_HOURS,
  CLUSTER_SOFT_MAX_COUNT,
} from "@/lib/experiencesPlaces";

/**
 * Wall-clock day meter for Areas & Neighborhoods (Asakusa, Shibuya…).
 * Areas are free individually; they spend time toward an 8h day (≈3 areas).
 * Private guide is an optional day-level layer — not priced per place.
 *
 * Prop names keep `selectedClusters` for internal/API compatibility.
 */

export type DailyTimeBudgetCluster = {
  title?: string;
  duration_hours?: number;
};

export function DailyTimeBudgetBar({
  selectedClusters = [],
  hasGuide = false,
  maxHours = CLUSTER_DAY_MAX_HOURS,
}: {
  selectedClusters?: DailyTimeBudgetCluster[];
  hasGuide?: boolean;
  maxHours?: number;
}) {
  const totalHours = selectedClusters.reduce((sum, c) => {
    const n = Number(c.duration_hours);
    return sum + (Number.isFinite(n) && n > 0 ? n : CLUSTER_DEFAULT_HOURS);
  }, 0);
  const isOverBudget = totalHours > maxHours + 0.01;
  const pct = Math.min(100, maxHours > 0 ? (totalHours / maxHours) * 100 : 0);
  const areaCount = selectedClusters.length;

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Daily time budget ({areaCount} area
          {areaCount === 1 ? "" : "s"})
        </span>
        <span
          className={`font-bold ${
            isOverBudget ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {Number(totalHours.toFixed(1))} / {maxHours} hours
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-all ${
            isOverBudget ? "bg-red-500" : "bg-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
        <span className="text-zinc-500">
          {isOverBudget
            ? "Exceeds standard day budget — trim an area or shorten hours"
            : `Aim for ~${CLUSTER_SOFT_MAX_COUNT} areas to fill a ${maxHours}h day · places inside an area stay free`}
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
            hasGuide
              ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-zinc-400"
          }`}
        >
          {hasGuide ? "Private guide added" : "Self-guided day"}
        </span>
      </div>
    </div>
  );
}
