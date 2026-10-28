/**
 * Operations Calendar — event model + date-range helpers (no heavy calendar lib).
 *
 * Grid placement uses service days from `calendarServiceMapper` (tours / guides /
 * transit / tickets). Stay range (tour_date → end_date) is kept for Summary Card
 * only — never stretched across empty rest days on the grid.
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { addDaysIso } from "@/lib/dateCascade";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import {
  mapHubToCalendarServices,
  type CalendarContinuousSegment,
  type CalendarServiceDayPoint,
  type ContinuityRole,
} from "@/lib/calendarServiceMapper";
import {
  classifyOpsCalendarStatus,
  shouldIncludeHubOnCalendar,
  type OpsCalendarColorKey,
  type OpsCalendarPaymentLane,
  type OpsCalendarStatusMeta,
} from "@/lib/opsCalendarStatus";
import { parseOpsHubExtras } from "@/lib/agentServices";

export type OpsCalendarView = "year" | "month" | "week" | "day";

export type OpsCalendarGuest = {
  email: string;
  name: string;
  phone: string;
  durationDays: number | null;
};

export type { ContinuityRole, CalendarServiceDayPoint, CalendarContinuousSegment };

export type OpsCalendarEvent = {
  id: string;
  pnr: string;
  title: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  primaryCity: string;
  /** Guest stay start (tour_date) — Summary Card; not grid span. */
  startDate: string; // YYYY-MM-DD
  /** Guest stay end — Summary Card; not grid span. */
  endDate: string; // YYYY-MM-DD inclusive
  /** Days with TokioTours services that render on the grid. */
  serviceDays: CalendarServiceDayPoint[];
  continuousSegments: CalendarContinuousSegment[];
  status: OpsCalendarStatusMeta;
  colorKey: OpsCalendarColorKey;
  paymentLane: OpsCalendarPaymentLane;
  actionRequired: boolean;
  assignedGuide: string;
  assignedDriver: string;
  assignedAgent: string;
  guestSummary: string;
  pickupNotes: string;
  specialRequests: string;
  scopeNotes: string;
  tourPaymentStatus: string;
  totalPaidEur: number;
  estimatedTotalEur: number;
  bookingStatus: string;
  hub: OpsHubRow;
};

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
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

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(raw?: string | null): Date | null {
  const iso = normalizeTourDateIso(raw);
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function endOfWeekSaturday(d: Date): Date {
  const start = startOfWeekSunday(d);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    12,
    0,
    0
  );
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1, 12, 0, 0);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameYmd(a: Date, b: Date): boolean {
  return toYmd(a) === toYmd(b);
}

export function formatMonthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDayTitle(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatWeekTitle(d: Date): string {
  const start = startOfWeekSunday(d);
  const end = endOfWeekSaturday(d);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

export function weekdayShort(d: Date): string {
  return WEEKDAYS_SHORT[d.getDay()];
}

export function monthShort(d: Date): string {
  return MONTHS_SHORT[d.getMonth()];
}

/** 6×7 month cell dates (leading/trailing padding). */
export function monthGridDates(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeekSunday(first);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
  return cells;
}

export function weekDates(anchor: Date): Date[] {
  const start = startOfWeekSunday(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function eachDayInclusive(startIso: string, endIso: string): string[] {
  const start = normalizeTourDateIso(startIso);
  const end = normalizeTourDateIso(endIso) || start;
  if (!start) return [];
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
    guard += 1;
  }
  return out;
}

function specialRequestsText(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join("; ");
  }
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw);
    } catch {
      return "";
    }
  }
  return "";
}

function scopeNotesFromHub(hub: OpsHubRow): string {
  const extras = parseOpsHubExtras(hub.extras);
  const lines = (extras.agent_services || [])
    .map((s) => String(s.notes || "").trim())
    .filter(Boolean);
  const unique = [...new Set(lines)];
  return unique.slice(0, 6).join(" · ");
}

export function buildOpsCalendarEvent(
  hub: OpsHubRow,
  opts?: {
    dispatch?: OpsDispatchRow | null;
    guest?: OpsCalendarGuest | null;
    hasOpenGuideJobs?: boolean;
    now?: Date;
  }
): OpsCalendarEvent | null {
  if (!shouldIncludeHubOnCalendar(hub)) return null;

  const durationDays = opts?.guest?.durationDays ?? null;
  const serviceMap = mapHubToCalendarServices({
    tourDate: hub.tour_date,
    endDate: hub.end_date,
    durationDays,
    extras: hub.extras,
  });
  if (!serviceMap) return null;

  const { stayStart: startDate, stayEnd: endDate, serviceDays, continuousSegments } =
    serviceMap;

  const status = classifyOpsCalendarStatus(hub, {
    dispatch: opts?.dispatch,
    durationDays,
    now: opts?.now,
    hasOpenGuideJobs: opts?.hasOpenGuideJobs,
  });

  const guestName =
    String(opts?.guest?.name || "").trim() ||
    String(hub.guest_summary || "").trim() ||
    "Guest";
  const city = String(hub.primary_city || "").trim() || "Japan";
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase();

  return {
    id: hub.id || pnr,
    pnr,
    title: `${pnr} · ${city}`,
    guestName,
    guestEmail: String(opts?.guest?.email || "").trim(),
    guestPhone: String(opts?.guest?.phone || "").trim(),
    primaryCity: city,
    startDate,
    endDate,
    serviceDays,
    continuousSegments,
    status,
    colorKey: status.colorKey,
    paymentLane: status.paymentLane,
    actionRequired: status.actionRequired,
    assignedGuide:
      String(
        opts?.dispatch?.assigned_guide || hub.assigned_guide || ""
      ).trim() || "—",
    assignedDriver:
      String(
        opts?.dispatch?.assigned_driver || hub.assigned_driver || ""
      ).trim() || "—",
    assignedAgent: String(hub.assigned_agent || "").trim() || "—",
    guestSummary: String(hub.guest_summary || "").trim(),
    pickupNotes: String(hub.pickup_notes || "").trim(),
    specialRequests: specialRequestsText(hub.special_requests),
    scopeNotes: scopeNotesFromHub(hub),
    tourPaymentStatus: status.tourPaymentStatus,
    totalPaidEur: Math.max(0, Math.round(Number(hub.total_paid_eur) || 0)),
    estimatedTotalEur: Math.max(
      0,
      Math.round(Number(hub.estimated_total_eur) || 0)
    ),
    bookingStatus: String(hub.status || "").trim(),
    hub,
  };
}

export function buildOpsCalendarEvents(
  hubs: OpsHubRow[],
  opts?: {
    dispatchByPnr?: Record<string, OpsDispatchRow>;
    guestsByPnr?: Record<string, OpsCalendarGuest>;
    openGuideJobPnrs?: Set<string>;
    now?: Date;
  }
): OpsCalendarEvent[] {
  const out: OpsCalendarEvent[] = [];
  for (const hub of hubs) {
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    const ev = buildOpsCalendarEvent(hub, {
      dispatch: opts?.dispatchByPnr?.[pnr] || null,
      guest: opts?.guestsByPnr?.[pnr] || null,
      hasOpenGuideJobs: opts?.openGuideJobPnrs?.has(pnr),
      now: opts?.now,
    });
    if (ev) out.push(ev);
  }
  out.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.pnr.localeCompare(b.pnr));
  return out;
}

/** Grid placement — true only on days with mapped TokioTours services. */
export function eventOccursOn(ev: OpsCalendarEvent, ymd: string): boolean {
  return ev.serviceDays.some((d) => d.date === ymd);
}

export function serviceDayMetaFor(
  ev: OpsCalendarEvent,
  ymd: string
): CalendarServiceDayPoint | null {
  return ev.serviceDays.find((d) => d.date === ymd) || null;
}

export function eventsForDay(
  events: OpsCalendarEvent[],
  ymd: string
): OpsCalendarEvent[] {
  return events
    .filter((e) => eventOccursOn(e, ymd))
    .sort((a, b) => a.pnr.localeCompare(b.pnr) || a.id.localeCompare(b.id));
}

/** Overlaps a range when any service day falls inside (not full stay). */
export function eventsOverlappingRange(
  events: OpsCalendarEvent[],
  startIso: string,
  endIso: string
): OpsCalendarEvent[] {
  return events.filter((e) =>
    e.serviceDays.some((d) => d.date >= startIso && d.date <= endIso)
  );
}

export type OpsCalendarFilters = {
  confirmed: boolean;
  design: boolean;
  draft: boolean;
  actionRequired: boolean;
};

export const DEFAULT_OPS_CALENDAR_FILTERS: OpsCalendarFilters = {
  confirmed: true,
  design: true,
  draft: true,
  actionRequired: true,
};

export function filterCalendarEvents(
  events: OpsCalendarEvent[],
  filters: OpsCalendarFilters
): OpsCalendarEvent[] {
  return events.filter((e) => {
    const payOk =
      (e.paymentLane === "confirmed" && filters.confirmed) ||
      (e.paymentLane === "design" && filters.design) ||
      (e.paymentLane === "draft" && filters.draft);
    const actionOk = e.actionRequired && filters.actionRequired;
    return payOk || actionOk;
  });
}

export function countByFilterLane(events: OpsCalendarEvent[]): {
  confirmed: number;
  design: number;
  draft: number;
  actionRequired: number;
  undatedHubs: number;
} {
  let confirmed = 0;
  let design = 0;
  let draft = 0;
  let actionRequired = 0;
  for (const e of events) {
    if (e.paymentLane === "confirmed") confirmed += 1;
    else if (e.paymentLane === "design") design += 1;
    else draft += 1;
    if (e.actionRequired) actionRequired += 1;
  }
  return { confirmed, design, draft, actionRequired, undatedHubs: 0 };
}
