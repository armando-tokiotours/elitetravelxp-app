import type { PbSeasonTier } from "@/lib/pocketbase/client";

export type SeasonTierName = "Low" | "Mid" | "High";

export type SeasonInsight = {
  tier: SeasonTierName;
  crowd_level: string;
  concierge_note: string;
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
} | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { month: MONTHS[m - 1], day: d };
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
