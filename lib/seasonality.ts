import type { PbSeasonTier } from "@/lib/pocketbase/client";

export type SeasonTierName = "Low" | "Mid" | "High";

export type SeasonInsight = {
  tier: SeasonTierName;
  crowd_level: string;
  concierge_note: string;
};

/** Ambient particle season (Japan travel calendar). */
export type ParticleSeason = "sakura" | "snow" | "momiji" | null;

export type SeasonalParticleMeta = {
  season: Exclude<ParticleSeason, null>;
  badge: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function parseArrivalParts(iso: string | null): {
  month: (typeof MONTHS)[number];
  day: number;
  monthIndex: number;
} | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { month: MONTHS[m - 1], day: d, monthIndex: m };
}

/** Resolve season rule for an arrival date from an in-memory list. */
export function resolveSeasonInsight(
  tiers: PbSeasonTier[],
  arrivalIso: string | null
): SeasonInsight | null {
  const parts = parseArrivalParts(arrivalIso);
  if (!parts) return null;

  const hit = tiers.find((row) => {
    if (row.is_active === false) return false;
    if (row.month !== parts.month) return false;
    const start = Number(row.start_day) || 1;
    const end = Number(row.end_day) || 31;
    return parts.day >= start && parts.day <= end;
  });

  if (!hit || !hit.tier) return null;

  return {
    tier: hit.tier,
    crowd_level: hit.crowd_level?.trim() || "",
    concierge_note: hit.concierge_note?.trim() || "",
  };
}

/** Map calendar month (1–12) → ambient particle season. */
export function particleSeasonFromMonth(monthIndex: number): ParticleSeason {
  if (monthIndex >= 3 && monthIndex <= 5) return "sakura";
  if (monthIndex === 12 || monthIndex <= 2) return "snow";
  if (monthIndex >= 9 && monthIndex <= 11) return "momiji";
  return null;
}

/** ISO date (YYYY-MM-DD) or Date → particle season. */
export function particleSeasonFromDate(
  input: string | Date | null | undefined
): ParticleSeason {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return particleSeasonFromMonth(input.getMonth() + 1);
  }
  const parts = parseArrivalParts(input);
  return parts ? particleSeasonFromMonth(parts.monthIndex) : null;
}

/** "April 2026" / "April" style month labels from TimingSelector. */
export function particleSeasonFromMonthLabel(
  label: string | null | undefined
): ParticleSeason {
  if (!label) return null;
  const lower = label.trim().toLowerCase();
  const idx = MONTHS.findIndex((m) => lower.startsWith(m.toLowerCase()));
  if (idx < 0) return null;
  return particleSeasonFromMonth(idx + 1);
}

export function seasonalParticleMeta(
  season: ParticleSeason
): SeasonalParticleMeta | null {
  if (season === "sakura") {
    return {
      season,
      badge: "Sakura Peak Season Detected",
    };
  }
  if (season === "snow") {
    return {
      season,
      badge: "Hokkaido Powder Snow",
    };
  }
  if (season === "momiji") {
    return {
      season,
      badge: "Momiji Foliage Season",
    };
  }
  return null;
}
