/**
 * Operations Calendar — map ops_hub cart lines → service-day placement.
 *
 * Placement rules (grid only; stay range lives in Summary Card):
 * - continuous-eligible: TOUR / GUIDE / TRANSIT / chauffeur work
 * - ticket-only days: isolated pills (not bridged)
 * - rest / empty: no TokioTours booked services → blank on the grid
 *
 * Dates resolve from item.serviceDate | scheduledDate | notes "Date YYYY-MM-DD"
 * or tour_date + dayNumber (notes "Day N" / day_number fields).
 */

import { addDaysIso } from "@/lib/dateCascade";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import { isTripWidePassItem } from "@/lib/guestItineraryDays";
import { resolveTripEndDate } from "@/lib/remindersEngine";
import {
  isActiveAgentService,
  isGuideServiceItem,
  isTicketServiceItem,
  isTransitServiceItem,
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";

/** What kind of cart work lands on a calendar day. */
export type CalendarServiceKind = "tour" | "guide" | "transit" | "ticket";

/**
 * continuous — tour/guide/transit/chauffeur (bridge-eligible)
 * ticket_only — tickets/passes only (isolated pill)
 */
export type CalendarDayKind = "continuous" | "ticket_only";

/**
 * Continuity within a consecutive continuous-eligible run:
 * start | mid | end | single (one-day run) | isolated (ticket-only).
 */
export type ContinuityRole =
  | "start"
  | "mid"
  | "end"
  | "single"
  | "isolated";

export type CalendarServiceDayPoint = {
  date: string;
  dayKind: CalendarDayKind;
  continuity: ContinuityRole;
  serviceKinds: CalendarServiceKind[];
  titles: string[];
};

export type CalendarContinuousSegment = {
  start: string;
  end: string;
};

export type CalendarServiceMap = {
  /** Guest stay window (tour_date → end_date) — Summary Card only. */
  stayStart: string;
  stayEnd: string;
  /** Days that should render on the grid. */
  serviceDays: CalendarServiceDayPoint[];
  continuousSegments: CalendarContinuousSegment[];
};

export function isContinuousEligibleService(item: ServiceLineItem): boolean {
  if (!isActiveAgentService(item)) return false;
  if (isTicketServiceItem(item)) return false;
  if (isTransitServiceItem(item)) return true;
  if (isGuideServiceItem(item)) return true;
  if (String(item.category || "").toUpperCase() === "TOUR") return true;
  return false;
}

export function isTicketOnlyCalendarService(item: ServiceLineItem): boolean {
  if (!isActiveAgentService(item)) return false;
  if (!isTicketServiceItem(item)) return false;
  // Trip-wide IC / JR passes are not a single service day on the grid.
  if (isTripWidePassItem(item)) return false;
  return true;
}

function classifyServiceKind(item: ServiceLineItem): CalendarServiceKind | null {
  if (!isActiveAgentService(item)) return null;
  if (isTicketServiceItem(item)) {
    if (isTripWidePassItem(item)) return null;
    return "ticket";
  }
  if (isTransitServiceItem(item)) return "transit";
  if (isGuideServiceItem(item)) {
    return String(item.category || "").toUpperCase() === "TOUR"
      ? "tour"
      : "guide";
  }
  if (String(item.category || "").toUpperCase() === "TOUR") return "tour";
  return null;
}

/** Extract day index from notes ("Day 3") or loose day_number fields. */
export function extractDayNumber(item: ServiceLineItem): number | null {
  const loose = item as ServiceLineItem & {
    dayNumber?: unknown;
    day_number?: unknown;
  };
  const raw = Number(loose.dayNumber ?? loose.day_number);
  if (Number.isFinite(raw) && raw >= 1) return Math.round(raw);

  const notes = String(item.notes || "");
  const m = notes.match(/\bDay\s+(\d+)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return null;
}

/**
 * Absolute YYYY-MM-DD for a cart line, or null when undated.
 * Prefer explicit dates; else tour_date + (dayNumber − 1).
 */
export function resolveServiceItemDate(
  item: ServiceLineItem,
  tourDate?: string | null
): string | null {
  const direct =
    normalizeTourDateIso(item.serviceDate) ||
    normalizeTourDateIso(item.scheduledDate);
  if (direct) return direct;

  const loose = item as ServiceLineItem & { date?: unknown };
  const alias = normalizeTourDateIso(String(loose.date || ""));
  if (alias) return alias;

  const notes = String(item.notes || "");
  const dateInNotes = notes.match(
    /\bDate\s+(\d{4}-\d{2}-\d{2})\b/i
  );
  if (dateInNotes) {
    const fromNotes = normalizeTourDateIso(dateInNotes[1]);
    if (fromNotes) return fromNotes;
  }

  const start = normalizeTourDateIso(tourDate);
  const dayNum = extractDayNumber(item);
  if (start && dayNum != null) {
    return dayNum === 1 ? start : addDaysIso(start, dayNum - 1);
  }

  return null;
}

function consecutive(a: string, b: string): boolean {
  return addDaysIso(a, 1) === b;
}

function buildContinuityRoles(
  sortedDates: string[]
): Map<string, ContinuityRole> {
  const roles = new Map<string, ContinuityRole>();
  if (sortedDates.length === 0) return roles;

  let segStart = 0;
  for (let i = 1; i <= sortedDates.length; i++) {
    const atEnd = i === sortedDates.length;
    const broke =
      atEnd || !consecutive(sortedDates[i - 1], sortedDates[i]);
    if (!broke) continue;

    const seg = sortedDates.slice(segStart, i);
    if (seg.length === 1) {
      roles.set(seg[0], "single");
    } else {
      for (let j = 0; j < seg.length; j++) {
        if (j === 0) roles.set(seg[j], "start");
        else if (j === seg.length - 1) roles.set(seg[j], "end");
        else roles.set(seg[j], "mid");
      }
    }
    segStart = i;
  }
  return roles;
}

function segmentsFromRoles(
  sortedDates: string[],
  roles: Map<string, ContinuityRole>
): CalendarContinuousSegment[] {
  const out: CalendarContinuousSegment[] = [];
  let i = 0;
  while (i < sortedDates.length) {
    const d = sortedDates[i];
    const role = roles.get(d);
    if (role === "single") {
      out.push({ start: d, end: d });
      i += 1;
      continue;
    }
    if (role === "start") {
      let end = d;
      let j = i + 1;
      while (j < sortedDates.length) {
        const r = roles.get(sortedDates[j]);
        end = sortedDates[j];
        j += 1;
        if (r === "end") break;
      }
      out.push({ start: d, end });
      i = j;
      continue;
    }
    // Orphan mid/end — treat as single
    out.push({ start: d, end: d });
    i += 1;
  }
  return out;
}

type DayBucket = {
  kinds: Set<CalendarServiceKind>;
  titles: string[];
  hasContinuous: boolean;
  hasTicket: boolean;
};

/**
 * Map a hub (+ optional pre-parsed services) to stay range + grid service days.
 * When the cart is empty / undated, falls back to a single pill on tour_date
 * (never the full stay span).
 */
export function mapHubToCalendarServices(input: {
  tourDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  extras?: unknown;
  services?: ServiceLineItem[] | null;
}): CalendarServiceMap | null {
  const stayStart = normalizeTourDateIso(input.tourDate);
  if (!stayStart) return null;

  const stayEnd =
    resolveTripEndDate({
      tour_date: input.tourDate,
      end_date: input.endDate,
      duration_days: input.durationDays,
    }) || stayStart;

  const services =
    input.services ??
    parseOpsHubExtras(input.extras).agent_services ??
    [];

  const byDate = new Map<string, DayBucket>();

  const ensure = (date: string): DayBucket => {
    let b = byDate.get(date);
    if (!b) {
      b = {
        kinds: new Set(),
        titles: [],
        hasContinuous: false,
        hasTicket: false,
      };
      byDate.set(date, b);
    }
    return b;
  };

  for (const item of services) {
    const kind = classifyServiceKind(item);
    if (!kind) continue;

    const continuous = isContinuousEligibleService(item);
    const ticketOnly = kind === "ticket";
    if (!continuous && !ticketOnly) continue;

    let date = resolveServiceItemDate(item, stayStart);
    // Undated continuous work still needs a grid pin — use tour start, not stay.
    if (!date && continuous) date = stayStart;
    if (!date) continue;

    const bucket = ensure(date);
    bucket.kinds.add(kind);
    const title = String(item.title || "").trim();
    if (title && !bucket.titles.includes(title)) bucket.titles.push(title);
    if (continuous) bucket.hasContinuous = true;
    if (ticketOnly) bucket.hasTicket = true;
  }

  // No cart detail → single fallback day on tour_date (not full stay).
  if (byDate.size === 0) {
    ensure(stayStart).hasContinuous = true;
  }

  const continuousDates = [...byDate.entries()]
    .filter(([, b]) => b.hasContinuous)
    .map(([d]) => d)
    .sort();

  const continuity = buildContinuityRoles(continuousDates);
  const continuousSegments = segmentsFromRoles(continuousDates, continuity);

  const serviceDays: CalendarServiceDayPoint[] = [...byDate.entries()]
    .map(([date, bucket]) => {
      const dayKind: CalendarDayKind = bucket.hasContinuous
        ? "continuous"
        : "ticket_only";
      const role: ContinuityRole =
        dayKind === "ticket_only"
          ? "isolated"
          : continuity.get(date) || "single";
      return {
        date,
        dayKind,
        continuity: role,
        serviceKinds: [...bucket.kinds],
        titles: bucket.titles.slice(0, 8),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    stayStart,
    stayEnd,
    serviceDays,
    continuousSegments,
  };
}
