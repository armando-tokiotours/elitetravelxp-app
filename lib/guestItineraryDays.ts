import type { ServiceLineItem } from "@/lib/agentServices";
import { addDaysIso, stayNightDates } from "@/lib/dateCascade";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import type { SelectedTour } from "@/lib/selectedTours";

/** Suica / PASMO / JR Pass — trip-wide, not a single calendar day. */
export function isTripWidePassText(...parts: Array<string | null | undefined>): boolean {
  const hay = parts
    .map((p) => String(p || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!hay) return false;
  return (
    hay.includes("suica") ||
    hay.includes("pasmo") ||
    hay.includes("icoca") ||
    hay.includes("jr pass") ||
    hay.includes("japan rail pass") ||
    hay.includes("rail pass") ||
    /\bic[\s-]?card\b/.test(hay)
  );
}

export function isTripWidePassItem(item: ServiceLineItem): boolean {
  return isTripWidePassText(item.title, item.notes, item.category);
}

export function itemServiceDate(item: ServiceLineItem): string {
  return (
    normalizeTourDateIso(
      String(item.serviceDate || item.scheduledDate || "")
    ) || ""
  );
}

/** Calendar days of a stay (arrival night through last night). */
export function stayDatesForRange(opts: {
  startDate?: string;
  endDate?: string;
  nights?: number;
}): string[] {
  const start =
    normalizeTourDateIso(opts.startDate || "") ||
    String(opts.startDate || "").slice(0, 10);
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  if (opts.endDate) {
    const nights = stayNightDates(start, opts.endDate);
    if (nights.length) return nights;
  }
  const n = Math.max(1, Number(opts.nights) || 1);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i === 0 ? start : addDaysIso(start, i));
  }
  return out;
}

function normTitle(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ticketMatchesTour(item: ServiceLineItem, tour: SelectedTour): boolean {
  const src = String(item.catalogSourceId || "").trim();
  if (src && (src === tour.tourId || src === String(tour.title || "").trim())) {
    return true;
  }
  const a = normTitle(item.title || "");
  const b = normTitle(tour.title || "");
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export type GuestDayTourBucket = {
  date: string;
  tours: SelectedTour[];
};

/**
 * Split cart tickets into trip-wide passes vs one assignment per calendar day.
 * Each ticket is claimed at most once so Day 2 never repeats Day 1 rows.
 */
export function partitionGuestTickets(opts: {
  ticketItems: ServiceLineItem[];
  dayTours: GuestDayTourBucket[];
}): {
  tripWide: ServiceLineItem[];
  byDate: Record<string, ServiceLineItem[]>;
} {
  const tripWide: ServiceLineItem[] = [];
  const datedPool: ServiceLineItem[] = [];
  for (const item of opts.ticketItems) {
    if (isTripWidePassItem(item)) tripWide.push(item);
    else datedPool.push(item);
  }

  const byDate: Record<string, ServiceLineItem[]> = {};
  const used = new Set<string>();
  const push = (date: string, item: ServiceLineItem) => {
    if (!date || used.has(item.id)) return;
    used.add(item.id);
    (byDate[date] ||= []).push(item);
  };

  for (const item of datedPool) {
    const d = itemServiceDate(item);
    if (d && opts.dayTours.some((x) => x.date === d)) push(d, item);
  }

  for (const day of opts.dayTours) {
    for (const item of datedPool) {
      if (used.has(item.id)) continue;
      if (day.tours.some((t) => ticketMatchesTour(item, t))) {
        push(day.date, item);
      }
    }
  }

  const leftover = datedPool.filter((i) => !used.has(i.id));
  if (leftover.length) {
    const fallback =
      opts.dayTours.find((d) => d.tours.length > 0)?.date ||
      opts.dayTours[0]?.date;
    if (fallback) {
      for (const item of leftover) push(fallback, item);
    }
  }

  return { tripWide, byDate };
}
