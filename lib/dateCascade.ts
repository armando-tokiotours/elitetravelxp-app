/** Cascading stay date ranges from trip arrival + night allocations. */

export interface LocationNightsLike {
  key?: string;
  cityId: string;
  nights: number;
}

export interface CityDateRange {
  key?: string;
  cityId: string;
  nights: number;
  /** Inclusive stay start (YYYY-MM-DD) */
  startDate: string;
  /** Inclusive stay end / departure day from this city (YYYY-MM-DD) */
  endDate: string;
  /** e.g. "12–14 Nov" */
  label: string;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Add N calendar days to YYYY-MM-DD (local). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** Format a city stay as "12–14 Nov" (or "12–14 Nov 2027" if year spans). */
export function formatCityDateRange(startIso: string, endIso: string): string {
  const a = parseIso(startIso);
  const b = parseIso(endIso);
  if (!a || !b) return "";
  const sameMonth = a.m === b.m;
  const sameYear = a.y === b.y;
  const monthA = MONTHS_SHORT[a.m - 1];
  const monthB = MONTHS_SHORT[b.m - 1];

  if (sameMonth && sameYear) {
    return `${a.d}–${b.d} ${monthA}`;
  }
  if (sameYear) {
    return `${a.d} ${monthA}–${b.d} ${monthB}`;
  }
  return `${a.d} ${monthA} ${a.y}–${b.d} ${monthB} ${b.y}`;
}

/**
 * Sequential stay windows:
 * City #1 (N nights) starts on arrivalDate, ends arrivalDate + N.
 * City #2 starts on City #1 end, ends start + nights, etc.
 * 0-night arrival/departure waypoints share a single day and do not advance the cursor.
 */
export function calculateCityDateRanges(
  arrivalDate: string | null | undefined,
  locations: LocationNightsLike[]
): CityDateRange[] {
  if (!arrivalDate || locations.length === 0) return [];

  let cursor = arrivalDate;
  return locations.map((loc) => {
    const nights = Math.max(0, Math.round(Number(loc.nights) || 0));
    const startDate = cursor;
    const endDate = nights === 0 ? startDate : addDaysIso(startDate, nights);
    cursor = endDate;
    return {
      key: loc.key,
      cityId: loc.cityId,
      nights,
      startDate,
      endDate,
      label:
        nights === 0
          ? formatCityDateSingle(startDate)
          : formatCityDateRange(startDate, endDate),
    };
  });
}

/** Format a single day as "12 Nov". */
export function formatCityDateSingle(iso: string): string {
  const a = parseIso(iso);
  if (!a) return "";
  return `${a.d} ${MONTHS_SHORT[a.m - 1]}`;
}

export interface ChauffeurDayOption {
  /** YYYY-MM-DD */
  date: string;
  /** 1-based day index from trip arrival */
  tripDay: number;
  /** e.g. "Day 1 · Monday, Oct 12" */
  label: string;
}

/** Inclusive ISO dates from start through day before end (stay nights). */
export function stayNightDates(startIso: string, endIso: string): string[] {
  if (!startIso || !endIso || startIso >= endIso) {
    return startIso && startIso === endIso ? [startIso] : [];
  }
  const out: string[] = [];
  let cursor = startIso;
  while (cursor < endIso) {
    out.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return out;
}

function formatChauffeurDayLabel(iso: string, tripDay: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return `Day ${tripDay}`;
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Day ${tripDay} · ${weekday}, ${monthDay}`;
}

/**
 * Full in-city days for chauffeur selection (stay nights; excludes departure
 * morning of the following city). Aggregates multiple stays in the same city.
 */
export function chauffeurDaysForCity(
  arrivalDate: string | null | undefined,
  locations: LocationNightsLike[],
  cityId: string
): ChauffeurDayOption[] {
  if (!arrivalDate || !cityId) return [];
  const ranges = calculateCityDateRanges(arrivalDate, locations).filter(
    (r) => r.cityId === cityId && r.nights > 0
  );
  const seen = new Set<string>();
  const days: ChauffeurDayOption[] = [];
  for (const range of ranges) {
    for (const date of stayNightDates(range.startDate, range.endDate)) {
      if (seen.has(date)) continue;
      seen.add(date);
      const tripDay =
        Math.round(
          (new Date(date + "T12:00:00").getTime() -
            new Date(arrivalDate + "T12:00:00").getTime()) /
            86400000
        ) + 1;
      days.push({
        date,
        tripDay: Math.max(1, tripDay),
        label: formatChauffeurDayLabel(date, Math.max(1, tripDay)),
      });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}
