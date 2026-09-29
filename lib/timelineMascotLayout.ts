/**
 * Timeline mascot row layout — bar vs character slot widths.
 * Edited in Team Access → Layout Builder; consumed by Builder M / S progress bars.
 */

export type TimelineMascotAlign = "start" | "center" | "end";

export type TimelineMascotRowLayout = {
  /** Progress track width (% of row). Default 75 = 6/8. */
  barPct: number;
  /** Empty gap after bar, before mascot (% of row). */
  gapBeforePct: number;
  /** Mascot column width (% of row). */
  mascotPct: number;
  /** Empty gap after mascot (% of row). Remainder soft-normalized on save. */
  gapAfterPct: number;
  /** Align mascot inside its column. */
  align: TimelineMascotAlign;
  /** Fine nudge as % of row (negative = left). */
  nudgePct: number;
  /** Mascot scale %. */
  scalePct: number;
};

export type TimelineMascotLayout = {
  version: 1;
  multi: TimelineMascotRowLayout;
  single: TimelineMascotRowLayout;
};

export const TIMELINE_MASCOT_LAYOUT_LOCAL_KEY = "tokio_timeline_mascot_layout";
export const TIMELINE_MASCOT_LAYOUT_EVENT = "timeline-mascot-layout-updated";

const ROW_DEFAULT: TimelineMascotRowLayout = {
  barPct: 75,
  gapBeforePct: 8.33,
  mascotPct: 8.34,
  gapAfterPct: 8.33,
  align: "start",
  nudgePct: 0,
  scalePct: 100,
};

export const TIMELINE_MASCOT_LAYOUT_DEFAULTS: TimelineMascotLayout = {
  version: 1,
  multi: { ...ROW_DEFAULT },
  single: { ...ROW_DEFAULT },
};

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function mergeRow(
  base: TimelineMascotRowLayout,
  raw: unknown
): TimelineMascotRowLayout {
  if (!raw || typeof raw !== "object") return { ...base };
  const o = raw as Record<string, unknown>;
  const alignRaw = String(o.align || base.align);
  const align: TimelineMascotAlign =
    alignRaw === "center" || alignRaw === "end" || alignRaw === "start"
      ? alignRaw
      : base.align;

  let barPct = clamp(o.barPct, 40, 92, base.barPct);
  let gapBeforePct = clamp(o.gapBeforePct, 0, 40, base.gapBeforePct);
  let mascotPct = clamp(o.mascotPct, 4, 40, base.mascotPct);
  let gapAfterPct = clamp(o.gapAfterPct, 0, 40, base.gapAfterPct);

  const sum = barPct + gapBeforePct + mascotPct + gapAfterPct;
  if (sum > 0 && Math.abs(sum - 100) > 0.05) {
    const scale = 100 / sum;
    barPct = Math.round(barPct * scale * 100) / 100;
    gapBeforePct = Math.round(gapBeforePct * scale * 100) / 100;
    mascotPct = Math.round(mascotPct * scale * 100) / 100;
    gapAfterPct = Math.round((100 - barPct - gapBeforePct - mascotPct) * 100) / 100;
  }

  return {
    barPct,
    gapBeforePct,
    mascotPct,
    gapAfterPct,
    align,
    nudgePct: clamp(o.nudgePct, -30, 30, base.nudgePct),
    scalePct: clamp(o.scalePct, 50, 180, base.scalePct),
  };
}

export function mergeTimelineMascotLayout(raw: unknown): TimelineMascotLayout {
  if (!raw || typeof raw !== "object") {
    return structuredClone(TIMELINE_MASCOT_LAYOUT_DEFAULTS);
  }
  const o = raw as Record<string, unknown>;
  return {
    version: 1,
    multi: mergeRow(TIMELINE_MASCOT_LAYOUT_DEFAULTS.multi, o.multi),
    single: mergeRow(TIMELINE_MASCOT_LAYOUT_DEFAULTS.single, o.single),
  };
}

export function readTimelineMascotLayoutLocal(): TimelineMascotLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TIMELINE_MASCOT_LAYOUT_LOCAL_KEY);
    if (!raw) return null;
    return mergeTimelineMascotLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeTimelineMascotLayoutLocal(
  layout: TimelineMascotLayout,
  opts?: { broadcast?: boolean }
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TIMELINE_MASCOT_LAYOUT_LOCAL_KEY,
      JSON.stringify(layout)
    );
    if (opts?.broadcast !== false) {
      window.dispatchEvent(
        new CustomEvent(TIMELINE_MASCOT_LAYOUT_EVENT, { detail: layout })
      );
    }
  } catch {
    /* ignore quota */
  }
}

export function alignToJustify(
  align: TimelineMascotAlign
): "flex-start" | "center" | "flex-end" {
  if (align === "center") return "center";
  if (align === "end") return "flex-end";
  return "flex-start";
}
