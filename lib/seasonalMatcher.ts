/**
 * Match seasonal_highlights to a traveler's city stays.
 */

export interface SeasonalHighlight {
  id: string;
  title: string;
  city_id?: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  description?: string;
  suggested_tour_id?: string;
  badge_text?: string;
  cover_photo?: string;
  is_active?: boolean;
  collectionId?: string;
}

export interface LocationStopLike {
  cityId: string;
  nights: number;
}

export interface CityStayWindow {
  cityId: string;
  start: Date;
  end: Date;
  nights: number;
}

export interface SeasonalMatch {
  highlight: SeasonalHighlight;
  cityId: string;
  stayStart: Date;
  stayEnd: Date;
  /** Human stay range shown in concierge copy */
  stayLabel: string;
}

const MONTH_SHORT = [
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
];

/** Day-of-year style key for month/day (non-leap; Feb 29 → 60). */
export function monthDayKey(month: number, day: number): number {
  const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const m = Math.min(12, Math.max(1, Math.round(month)));
  const d = Math.min(daysInMonth[m], Math.max(1, Math.round(day)));
  let key = d;
  for (let i = 1; i < m; i++) key += daysInMonth[i];
  return key;
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatShortRange(start: Date, end: Date): string {
  const a = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  const b = `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
  return a === b ? a : `${a}–${b}`;
}

/**
 * Build calendar windows for each city stay from arrival + nights.
 * Travel between cities is not modeled as a separate day; nights are contiguous.
 */
export function buildCityStays(
  arrivalDate: string | null | undefined,
  locations: LocationStopLike[]
): CityStayWindow[] {
  const arrival = parseIsoDate(arrivalDate);
  if (!arrival || locations.length === 0) return [];

  const stays: CityStayWindow[] = [];
  let cursor = new Date(arrival.getFullYear(), arrival.getMonth(), arrival.getDate());

  for (const loc of locations) {
    const nights = Math.max(1, Number(loc.nights) || 1);
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + nights - 1);
    stays.push({
      cityId: loc.cityId,
      start,
      end,
      nights,
    });
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }
  return stays;
}

/** True if calendar date (month/day) falls in [start, end], wrapping year if needed. */
export function dateInSeasonWindow(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): boolean {
  const key = monthDayKey(date.getMonth() + 1, date.getDate());
  const start = monthDayKey(startMonth, startDay);
  const end = monthDayKey(endMonth, endDay);
  if (start <= end) return key >= start && key <= end;
  // wraps year (e.g. Dec 15 → Jan 10)
  return key >= start || key <= end;
}

export function stayOverlapsSeason(
  stayStart: Date,
  stayEnd: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): boolean {
  const cursor = new Date(stayStart);
  while (cursor <= stayEnd) {
    if (
      dateInSeasonWindow(
        cursor,
        startMonth,
        startDay,
        endMonth,
        endDay
      )
    ) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

/**
 * Match active highlights to itinerary stays.
 * Highlights with empty city_id apply to every selected city ("All Japan").
 */
export function matchSeasonalHighlights(
  highlights: SeasonalHighlight[],
  arrivalDate: string | null | undefined,
  locations: LocationStopLike[]
): SeasonalMatch[] {
  const stays = buildCityStays(arrivalDate, locations);
  if (!stays.length) return [];

  const active = highlights.filter((h) => h.is_active !== false);
  const matches: SeasonalMatch[] = [];
  const seen = new Set<string>();

  for (const stay of stays) {
    for (const highlight of active) {
      const appliesToCity =
        !highlight.city_id || highlight.city_id === stay.cityId;
      if (!appliesToCity) continue;
      if (
        !stayOverlapsSeason(
          stay.start,
          stay.end,
          Number(highlight.start_month),
          Number(highlight.start_day),
          Number(highlight.end_month),
          Number(highlight.end_day)
        )
      ) {
        continue;
      }
      const key = `${highlight.id}:${stay.cityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        highlight,
        cityId: stay.cityId,
        stayStart: stay.start,
        stayEnd: stay.end,
        stayLabel: formatShortRange(stay.start, stay.end),
      });
    }
  }

  return matches;
}

export function matchesForCity(
  matches: SeasonalMatch[],
  cityId: string
): SeasonalMatch[] {
  return matches.filter((m) => m.cityId === cityId);
}
