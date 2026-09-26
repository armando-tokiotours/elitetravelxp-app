/**
 * Helpers for bookings_and_leads audit / display fields.
 */

import type { BookingLeadType } from "@/lib/bookingsAndLeads";

export function formatDurationLabel(
  type: BookingLeadType | string | undefined,
  value: number | null | undefined
): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return type === "single_day" ? "1 Day" : "";
  }
  if (type === "single_day") {
    if (n === 1) return "1 Hour";
    // Day-trip shorthand when hours look like a full day slot
    if (n >= 8) return "1 Day";
    return `${n} Hours`;
  }
  return n === 1 ? "1 Day" : `${n} Days`;
}

export function formatCitiesList(
  primaryCity?: string | null,
  cityNames?: string[] | null
): string {
  const fromList = (cityNames || [])
    .map((c) => String(c || "").trim())
    .filter(Boolean);
  if (fromList.length) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const c of fromList) {
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
    return unique.join(", ");
  }
  return String(primaryCity || "").trim();
}

export function formatAuditSentLabel(iso?: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
