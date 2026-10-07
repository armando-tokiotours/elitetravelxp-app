/**
 * Load guest/tour context for Ops inspector from bookings_and_leads (or hub fallback).
 */

import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import type {
  BookingsAndLeadsRecord,
  MultiDaySelections,
  SingleDaySelections,
} from "@/lib/bookingsAndLeads";
import {
  accessTypeStaffLabel,
  experienceNeedsEntryTicket,
} from "@/lib/accessType";
import { addDaysIso } from "@/lib/dateCascade";
import {
  applyOpsDemandForPnr,
  enrichDemandFromTourCatalog,
  tourIdsFromSelections,
} from "@/lib/opsDemand";
import { formatTransportType } from "@/lib/transportProducts";
import { isTripWidePassText } from "@/lib/guestItineraryDays";

export type OpsAccessLine = {
  tourId: string;
  title: string;
  accessType: string;
  label: string;
};

export type OpsDayTour = {
  tourId: string;
  title: string;
  language?: string;
  hours?: number;
};

export type OpsDayTicket = {
  title: string;
  type: string;
};

export type OpsItineraryDay = {
  date: string;
  dateLabel: string;
  dayIndex: number;
  hasCar: boolean;
  hasGuide: boolean;
  hasTickets: boolean;
  tours: OpsDayTour[];
  tickets: OpsDayTicket[];
};

export type OpsItineraryStop = {
  cityId: string;
  cityName: string;
  nights: number;
  startDate?: string;
  endDate?: string;
  dateLabel: string;
  hotelArrangement: "self" | "tokiotours" | "unset";
  hotelLabel: string;
  localTransitLabel: string;
  incomingTitle: string;
  incomingBullets: string[];
  /** Transfer out of this city toward the next stay (inter-city banner). */
  outgoingTitle?: string;
  outgoingBullets?: string[];
  days: OpsItineraryDay[];
};

export type OpsRouteTimeline = {
  arrivalHubLabel: string;
  arrivalVipLabel: string;
  departureHubLabel: string;
  departureDropoffLabel: string;
  stays: OpsItineraryStop[];
};

/** Brand product titles used on Torii / Start Trip / nav. */
export const OPS_PRODUCT_LABEL = {
  single_day: "1-Day Express Pass",
  multi_day: "Grand Japan Journey",
  experience_only: "VIP Tickets & Local Access",
} as const;

/**
 * Resolve Ops header product line from BAL type + selection heuristics.
 * Prefer `type`; fall back to builder-e markers, then single/multi shape.
 */
export function opsProductLabelFromLead(opts: {
  type?: string | null;
  selections?: unknown;
  durationLabel?: string | null;
  durationValue?: number | null;
}): string {
  const t = String(opts.type || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (t === "single_day" || t === "single") {
    return OPS_PRODUCT_LABEL.single_day;
  }
  if (t === "multi_day" || t === "multiday" || t === "multi") {
    return OPS_PRODUCT_LABEL.multi_day;
  }
  if (
    t === "experience_only" ||
    t === "experience" ||
    t === "builder_e" ||
    t === "vip" ||
    t === "vip_tickets"
  ) {
    return OPS_PRODUCT_LABEL.experience_only;
  }

  const sel =
    opts.selections && typeof opts.selections === "object"
      ? (opts.selections as Record<string, unknown>)
      : null;
  if (sel) {
    const src = String(sel.source || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    const bt = String(sel.booking_type || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (
      src === "builder_e" ||
      src.includes("builder_e") ||
      bt === "experience_only" ||
      bt.includes("experience")
    ) {
      return OPS_PRODUCT_LABEL.experience_only;
    }
    const multi = asMulti(sel);
    const single = asSingle(sel);
    if (Boolean(single) && !multi) return OPS_PRODUCT_LABEL.single_day;
    if (multi) return OPS_PRODUCT_LABEL.multi_day;
  }

  const dl = String(opts.durationLabel || "")
    .trim()
    .toLowerCase();
  if (dl.includes("hour")) return OPS_PRODUCT_LABEL.single_day;
  const days = Number(opts.durationValue);
  if (Number.isFinite(days) && days >= 2) return OPS_PRODUCT_LABEL.multi_day;
  if (dl.includes("day") && !dl.includes("1 day") && !dl.startsWith("1 ")) {
    return OPS_PRODUCT_LABEL.multi_day;
  }
  if (dl.includes("1 day") || dl === "1-day" || dl.startsWith("1 day")) {
    return OPS_PRODUCT_LABEL.single_day;
  }

  return "";
}

export type OpsGuestRequirements = {
  /** Guest profile */
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  adults: number;
  children: number;
  infants: number;
  /** JR / Suica questionnaire + transport mix */
  guestHasJRPass: boolean | null;
  guestHasICCard: boolean | null;
  guestNeedsTransitHelp: boolean | null;
  transportStrategy: string;
  /** Brand product: 1-Day Express Pass / Grand Japan Journey / VIP Tickets… */
  productLabel: string;
  /** Trip overview from BAL selections (no extra fetches) */
  totalDaysLabel: string;
  arrivalDateLabel: string;
  travelPaceLabel: string;
  /** Pre-quiz / builder vibe (VIP, Premium, Classic, Concierge…) */
  travelVibeLabel: string;
  interestsLabel: string;
  experienceTierLabel: string;
  /** Flight / hub logistics */
  arrivalHubLabel: string;
  arrivalVipLabel: string;
  departureHubLabel: string;
  departureDropoffLabel: string;
  arrivalFlightLabel: string;
  departureFlightLabel: string;
  shinkansenLabel: string;
  icCardsLabel: string;
  chauffeurPickupLabel: string;
  itineraryStops: OpsItineraryStop[];
  routeTimeline: OpsRouteTimeline;
  tourTitle: string;
  tourCode: string;
  meetingPointName: string;
  meetingPointAddress: string;
  startTime: string;
  durationLabel: string;
  tourLanguage: string;
  specialMobility: string;
  specialNotes: string;
  /** Ticket / Admission / VIP / Time-sensitive lines for Ops */
  accessLines: OpsAccessLine[];
  ticketsNeededFromCatalog: boolean;
  /** Total booked tour/experience lines across days */
  serviceCount: number;
};

type BalRow = BookingsAndLeadsRecord & {
  meeting_point_name?: string;
  meeting_point_address?: string;
  special_requests?: unknown;
  guest_name?: string;
  full_name?: string;
  contact_phone?: string;
  whatsapp?: string;
  phone?: string;
  guest_has_jr_pass?: boolean | null;
  guest_has_ic_card?: boolean | null;
  guest_needs_transit_help?: boolean | null;
};

async function firstOrNull<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function asMulti(sel: unknown): MultiDaySelections | null {
  if (!sel || typeof sel !== "object") return null;
  const s = sel as MultiDaySelections;
  if (Array.isArray(s.locationCityIds) || Array.isArray(s.experienceIds)) {
    return s;
  }
  return null;
}

function asSingle(sel: unknown): SingleDaySelections | null {
  if (!sel || typeof sel !== "object") return null;
  const s = sel as SingleDaySelections;
  if (
    s.cityId ||
    Array.isArray(s.selectedExperienceIds) ||
    s.tourHours != null ||
    s.startHour
  ) {
    return s;
  }
  return null;
}

function formatNeeds(needs?: string[] | null): string {
  if (!Array.isArray(needs) || needs.length === 0) return "—";
  return needs
    .map((n) =>
      String(n)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(", ");
}

function coerceTriBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return null;
}

function modeLabel(mode: string): string {
  const m = String(mode || "").trim().toLowerCase();
  if (m === "self") return "Self";
  if (m === "public") return "Public";
  if (m === "private") return "Private Chauffeur";
  return "";
}

/** Collapse inter-city + in-city modes into a single Ops label. */
function summarizeTransportStrategy(
  multi: MultiDaySelections | null,
  single: SingleDaySelections | null
): string {
  if (single) {
    const raw =
      String(single.transitOption || single.guidePreference || "").trim();
    const labeled = modeLabel(raw);
    if (labeled) return labeled;
    if (raw) return raw;
    return "Unset";
  }
  if (!multi) return "Unset";
  const modes = new Set<string>();
  for (const leg of multi.transitByLeg || []) {
    const m = String(leg.transitType || "").trim().toLowerCase();
    if (m && m !== "unset") modes.add(m);
  }
  for (const row of multi.localTransitByCity || []) {
    const m = String(row.localTransitType || "").trim().toLowerCase();
    if (m && m !== "unset") modes.add(m);
  }
  if (modes.size === 0) return "Unset";
  if (modes.size === 1) {
    return modeLabel([...modes][0]) || "Unset";
  }
  return "Mix-Arranged";
}

function pickGuestName(bal: BalRow | null, sel: Record<string, unknown>): string {
  const fromBal = String(
    bal?.guest_name || bal?.full_name || ""
  ).trim();
  if (fromBal) return fromBal;
  const fromSel = String(
    sel.guestName || sel.fullName || sel.contactName || ""
  ).trim();
  return fromSel || "—";
}

function pickGuestPhone(bal: BalRow | null, sel: Record<string, unknown>): string {
  const fromBal = String(
    bal?.contact_phone || bal?.whatsapp || bal?.phone || ""
  ).trim();
  if (fromBal) return fromBal;
  const fromSel = String(
    sel.guestPhone ||
      sel.contactPhone ||
      sel.whatsapp ||
      sel.phone ||
      ""
  ).trim();
  return fromSel || "—";
}

function formatPaceLabel(pace: unknown): string {
  const p = String(pace || "").trim().toLowerCase();
  if (p === "fast") return "Fast";
  if (p === "moderate") return "Moderate";
  if (p === "relaxed") return "Relaxed";
  return "—";
}

function formatTravelVibe(opts: {
  experienceService?: string | null;
  travelStyle?: unknown;
}): string {
  const style = String(opts.travelStyle || "")
    .trim()
    .toLowerCase();
  if (style === "vip_bespoke") return "VIP Bespoke · Luxury";
  if (style === "premium_comfort") return "Premium Comfort";
  if (style === "classic_explorer") return "Classic Explorer · Authentic";
  const svc = String(opts.experienceService || "")
    .trim()
    .toLowerCase();
  if (svc === "concierge") return "Elite Concierge · Luxury";
  if (svc === "tailored") return "Tailored Experiences";
  return "—";
}

function formatExperienceTier(experienceService?: string | null): string {
  const svc = String(experienceService || "")
    .trim()
    .toLowerCase();
  if (svc === "concierge") return "Concierge";
  if (svc === "tailored") return "Tailored";
  return "Hybrid / Unset";
}

function formatInterestsLabel(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "—";
  return raw
    .map((n) =>
      String(n)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(", ");
}

function pickFlightLabel(
  sel: Record<string, unknown>,
  keys: string[]
): string {
  for (const k of keys) {
    const v = String(sel[k] || "").trim();
    if (v) return v;
  }
  const driver =
    sel.driver && typeof sel.driver === "object"
      ? (sel.driver as Record<string, unknown>)
      : null;
  if (driver) {
    const fn = String(driver.flightNumber || "").trim();
    if (fn) return `Flight ${fn}`;
  }
  return "(pending confirm)";
}

function formatArrivalDate(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "—";

  // Normalize "2026-10-28 00:00:00.000Z" → ISO with T
  const normalized = s.includes("T")
    ? s
    : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T12:00:00`
      : normalized
  );
  if (Number.isNaN(d.getTime())) {
    // Last resort: date-only slice
    const day = s.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : s;
  }

  const datePart = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Midnight / date-only storage → never show 00:00:00
  const hasRealTime =
    !/T00:00:00(\.0+)?Z?$/i.test(normalized) &&
    !(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) &&
    !/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) &&
    /T\d{2}:\d{2}/.test(normalized) &&
    !/T00:00/.test(normalized);

  if (!hasRealTime) return datePart;

  const timePart = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function hotelLabelFor(
  arrangement: "self" | "tokiotours" | "unset",
  star?: string
): string {
  if (arrangement === "tokiotours") {
    const starTxt = star ? String(star).replace(/-star$/i, "") : "";
    return starTxt
      ? `TokioTours Books · ${starTxt}★`
      : "TokioTours Books";
  }
  if (arrangement === "self") return "Self-Arranged";
  return "Unset";
}

/**
 * True when lodging is required or selected for this stop.
 * Gate rendering only — do not treat false as “delete hotels feature”.
 *
 * Show when:
 * - TokioTours Books / Self-Arranged, or
 * - nights > 0 (multi-day stay needs a hotel even if arrangement still Unset), or
 * - a non-placeholder hotel label is present.
 *
 * Hide when Unset + 0 nights + no real label (single-day / Builder E / no lodging).
 */
export function stopHasRealAccommodation(stop: OpsItineraryStop): boolean {
  if (stop.hotelArrangement === "tokiotours" || stop.hotelArrangement === "self") {
    return true;
  }
  if (Math.max(0, Number(stop.nights) || 0) > 0) return true;
  const label = String(stop.hotelLabel || "").trim();
  if (label && label.toLowerCase() !== "unset") return true;
  return false;
}

/**
 * Stops to render as hotel cards in Hotel & Accommodation Summary.
 * Empty → section 3 header still shows; UI uses a minimal empty shell (no fake Unset/0-night cards).
 */
export function accommodationSummaryStops(
  stops: OpsItineraryStop[]
): OpsItineraryStop[] {
  return (stops || []).filter(stopHasRealAccommodation);
}

function formatStayDateRange(
  start?: string,
  end?: string
): string {
  if (!start && !end) return "Dates TBD";
  const a = formatArrivalDate(start);
  const b = formatArrivalDate(end);
  if (a !== "—" && b !== "—" && a !== b) return `${a} → ${b}`;
  return a !== "—" ? a : b;
}

function cleanDisplayTitle(title: string, id?: string): string {
  let t = String(title || "").trim();
  const tid = String(id || "").trim();
  if (!t) return "";
  // Strip " · j9g6jos98315ps6" style PB id suffixes
  t = t.replace(/\s*[·•]\s*[a-z0-9]{10,20}\s*$/i, "").trim();
  if (tid) {
    if (t === tid) return "";
    if (t.endsWith(tid)) {
      t = t
        .slice(0, -tid.length)
        .replace(/[\s·•\-–—]+$/g, "")
        .trim();
    }
  }
  return t;
}

function transitTitle(mode: string | null | undefined): string {
  const m = String(mode || "").trim().toLowerCase();
  if (m === "public") return "Rail / public transfer";
  if (m === "private") return "Private chauffeur transfer";
  if (m === "self") return "Self-arranged transfer";
  return "Transfer not set";
}

function transitBullets(opts: {
  mode?: string | null;
  cityName: string;
  needsTicket?: boolean;
  ticketType?: string;
  ticketPricePerPax?: number;
  direction?: "to" | "from";
}): string[] {
  const mode = String(opts.mode || "").trim().toLowerCase();
  const prep = opts.direction === "from" ? "from" : "to";
  if (!mode || mode === "unset") {
    return [`Transfer not configured ${prep} ${opts.cityName}`];
  }
  const bullets: string[] = [];
  if (mode === "public") {
    bullets.push(`Bullet Train (Shinkansen) / rail ${prep} ${opts.cityName}`);
    if (opts.needsTicket) {
      const ticket =
        opts.ticketType === "ic_card"
          ? "IC card / Suica"
          : opts.ticketType === "shinkansen_reserved"
            ? "Reserved Shinkansen seat"
            : "Public transit ticket";
      const price =
        opts.ticketPricePerPax && opts.ticketPricePerPax > 0
          ? ` · Est. €${Math.round(opts.ticketPricePerPax)}/pax`
          : "";
      bullets.push(`Tickets pre-booked · ${ticket}${price}`);
    } else {
      bullets.push("Tickets: self-purchase on site");
    }
  } else if (mode === "private") {
    bullets.push(`Private chauffeur ${prep} ${opts.cityName}`);
  } else if (mode === "self") {
    bullets.push(`Guest self-arranges transfer ${prep} ${opts.cityName}`);
  } else {
    bullets.push(`Transit method ${prep} ${opts.cityName}: ${mode}`);
  }
  return bullets;
}

function localTransitLabel(
  multi: MultiDaySelections | null,
  cityId: string
): string {
  const row = multi?.localTransitByCity?.find((r) => r.cityId === cityId);
  const labeled = modeLabel(String(row?.localTransitType || ""));
  return labeled ? `In-city: ${labeled}` : "In-city: Unset";
}

function enumerateStayDates(start?: string, nights?: number): string[] {
  const s = String(start || "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return [];
  const n = Math.max(0, Number(nights) || 0);
  // Stay of N nights covers N calendar days of activities (arrival day → last night)
  const days = Math.max(1, n);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(i === 0 ? s : addDaysIso(s, i));
  }
  return out;
}

function buildCityDays(opts: {
  cityId: string;
  cityName: string;
  startDate?: string;
  nights: number;
  multi: MultiDaySelections | null;
  resolvedTitles: Map<string, string>;
}): OpsItineraryDay[] {
  const { cityId, cityName, multi, resolvedTitles } = opts;
  const dates = enumerateStayDates(opts.startDate, opts.nights);
  const chauffeurDates = new Set(
    (multi?.chauffeurDaysByCity?.[cityId] || []).map((d) =>
      String(d).slice(0, 10)
    )
  );
  const cityTours = (multi?.experienceSchedule || []).filter(
    (e) => e.cityId === cityId
  );
  // Day-bound catalog tickets only — Suica / PASMO / JR Pass stay in the
  // trip-wide Ticket & access rollup, never nested under DAY 1 of each city.
  const cityTickets = (multi?.transportTickets || []).filter((t) => {
    // Require a city match — undated / no-city catalog (Suica…) → rollup only
    if (String(t.cityId || "") !== cityId) return false;
    const kind = String(t.transportType || "").toLowerCase();
    if (kind === "suica") return false;
    if (isTripWidePassText(t.name, t.transportType)) return false;
    return true;
  });
  const catalogTickets: OpsDayTicket[] = cityTickets.map((t) => ({
    title: cleanDisplayTitle(t.name, t.productId) || t.name,
    type: formatTransportType(t.transportType),
  }));

  // If no dated stay, still show one "Day services" bucket for undated tours/tickets
  const dayDates = dates.length > 0 ? dates : [""];

  return dayDates.map((date, idx) => {
    const datedTours = cityTours.filter((t) => {
      const td = String(t.date || "").slice(0, 10);
      if (!date) return !td;
      return td === date || (!td && idx === 0);
    });
    // Undated tours only on first day when we have a date grid
    const tours: OpsDayTour[] = datedTours.map((t) => {
      const raw =
        cleanDisplayTitle(String(t.title || ""), t.tourId) ||
        cleanDisplayTitle(resolvedTitles.get(t.tourId) || "", t.tourId) ||
        resolvedTitles.get(t.tourId) ||
        "Experience";
      return {
        tourId: t.tourId,
        title: raw,
        language: t.language || undefined,
        hours: t.durationHours,
      };
    });

    // Entry tickets for experiences on this day (TeamLab, museum, …) — not IC passes
    const entryTickets: OpsDayTicket[] = tours
      .filter((t) =>
        experienceNeedsEntryTicket({
          title: t.title,
        })
      )
      .map((t) => ({
        title: t.title,
        type: "Entry ticket",
      }));

    const dayTickets: OpsDayTicket[] =
      idx === 0 ? [...catalogTickets, ...entryTickets] : [...entryTickets];

    // Kamakura-style rail: when city name hints day trip + public local
    const local = multi?.localTransitByCity?.find((r) => r.cityId === cityId);
    if (
      idx === 0 &&
      String(local?.localTransitType || "").toLowerCase() === "public" &&
      /kamakura|hakone|nikko|fuji/i.test(cityName)
    ) {
      dayTickets.push({
        title: `${cityName} rail / transit`,
        type: formatTransportType("local_rail"),
      });
    }

    const hasCar = Boolean(date && chauffeurDates.has(date));
    const hasGuide = tours.length > 0;
    const hasTickets = dayTickets.length > 0;

    return {
      date,
      dateLabel: date ? formatArrivalDate(date) : "Date TBD",
      dayIndex: idx + 1,
      hasCar,
      hasGuide,
      hasTickets,
      tours,
      tickets: dayTickets,
    };
  });
}

/** Build stay rows + hub labels from already-loaded BAL (no extra fetches). */
function buildRouteTimeline(
  bal: BalRow | null,
  multi: MultiDaySelections | null,
  single: SingleDaySelections | null,
  resolvedTitles: Map<string, string>
): OpsRouteTimeline {
  const cityNames = String(bal?.cities_list || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Single-day: airport hubs N/A. Multi: real PB label, else pending confirm.
  const isSingleDay = Boolean(single) && !multi;
  const arrivalHubRaw = String(multi?.arrivalHubLabel || "").trim();
  const departureHubRaw = String(multi?.departureHubLabel || "").trim();
  const arrivalHubLabel = isSingleDay
    ? "-"
    : arrivalHubRaw ||
      (multi?.arrivalTransferId ? "Arrival hub selected" : "(pending confirm)");
  const departureHubLabel = isSingleDay
    ? "-"
    : departureHubRaw ||
      (multi?.departureTransferId
        ? "Departure hub selected"
        : "(pending confirm)");

  const arrivalVipLabel = isSingleDay
    ? "-"
    : multi?.airportPickup
      ? "Airport Meet & Greet / VIP pickup"
      : multi?.arrivalTransitType && multi.arrivalTransitType !== "unset"
        ? `Arrival transfer: ${modeLabel(multi.arrivalTransitType) || multi.arrivalTransitType}`
        : "(pending confirm)";

  const departureDropoffLabel = isSingleDay
    ? "-"
    : multi?.airportDropoff
      ? "VIP departure drop-off"
      : "(pending confirm)";

  const stays: OpsItineraryStop[] = [];

  if (multi) {
    if (Array.isArray(multi.locationStops) && multi.locationStops.length > 0) {
      for (let i = 0; i < multi.locationStops.length; i++) {
        const stop = multi.locationStops[i];
        const next = multi.locationStops[i + 1];
        const arrangement = stop.hotelArrangement || "unset";
        const cityName =
          String(stop.cityName || "").trim() ||
          cityNames[i] ||
          (i === 0 ? String(bal?.primary_city || "").trim() : "") ||
          stop.cityId ||
          "Unknown City";
        const mode =
          stop.incomingTransitType ||
          (i === 0
            ? multi.arrivalTransitType
            : multi.transitByLeg?.find(
                (l) =>
                  l.toCityId === stop.cityId ||
                  l.fromCityId === multi.locationStops?.[i - 1]?.cityId
              )?.transitType) ||
          null;

        let outgoingTitle: string | undefined;
        let outgoingBullets: string[] | undefined;
        if (next) {
          const nextName =
            String(next.cityName || "").trim() ||
            cityNames[i + 1] ||
            next.cityId ||
            "Next city";
          const outMode =
            multi.transitByLeg?.find(
              (l) =>
                l.fromCityId === stop.cityId && l.toCityId === next.cityId
            )?.transitType ||
            next.incomingTransitType ||
            null;
          outgoingTitle = `${transitTitle(outMode)} → ${nextName}`;
          outgoingBullets = transitBullets({
            mode: outMode,
            cityName: nextName,
            needsTicket: next.needsTicket,
            ticketType: next.ticketType,
            ticketPricePerPax: next.ticketPricePerPax,
            direction: "to",
          });
        }

        stays.push({
          cityId: stop.cityId,
          cityName,
          nights: Math.max(0, Number(stop.nights) || 0),
          startDate: stop.startDate,
          endDate: stop.endDate,
          dateLabel: formatStayDateRange(stop.startDate, stop.endDate),
          hotelArrangement: arrangement,
          hotelLabel: hotelLabelFor(arrangement, stop.hotelStar),
          localTransitLabel: localTransitLabel(multi, stop.cityId),
          incomingTitle: transitTitle(mode),
          incomingBullets: transitBullets({
            mode,
            cityName,
            needsTicket: stop.needsTicket,
            ticketType: stop.ticketType,
            ticketPricePerPax: stop.ticketPricePerPax,
          }),
          outgoingTitle,
          outgoingBullets,
          days: buildCityDays({
            cityId: stop.cityId,
            cityName,
            startDate: stop.startDate,
            nights: Math.max(0, Number(stop.nights) || 0),
            multi,
            resolvedTitles,
          }),
        });
      }
    } else {
      const ids = multi.locationCityIds || [];
      for (let i = 0; i < ids.length; i++) {
        const cityId = ids[i];
        const nextId = ids[i + 1];
        const hotelRaw = multi.hotelByCity?.[cityId];
        // Only treat as lodging when hotelByCity has an explicit star/pref.
        // Do not invent "self" for every city id — that falsely shows accommodation.
        const arrangement: OpsItineraryStop["hotelArrangement"] = hotelRaw
          ? "tokiotours"
          : "unset";
        const cityName =
          cityNames[i] ||
          (i === 0 ? String(bal?.primary_city || "").trim() : "") ||
          cityId ||
          "Unknown City";
        const leg = multi.transitByLeg?.find((l) => l.toCityId === cityId);
        const mode =
          i === 0
            ? multi.arrivalTransitType || leg?.transitType
            : leg?.transitType;

        let outgoingTitle: string | undefined;
        let outgoingBullets: string[] | undefined;
        if (nextId) {
          const nextName = cityNames[i + 1] || nextId;
          const outMode =
            multi.transitByLeg?.find(
              (l) => l.fromCityId === cityId && l.toCityId === nextId
            )?.transitType || null;
          outgoingTitle = `${transitTitle(outMode)} → ${nextName}`;
          outgoingBullets = transitBullets({
            mode: outMode,
            cityName: nextName,
            direction: "to",
          });
        }

        stays.push({
          cityId,
          cityName,
          nights: 0,
          dateLabel: "Dates TBD",
          hotelArrangement: arrangement,
          hotelLabel: hotelLabelFor(arrangement, hotelRaw),
          localTransitLabel: localTransitLabel(multi, cityId),
          incomingTitle: transitTitle(mode),
          incomingBullets: transitBullets({ mode, cityName }),
          outgoingTitle,
          outgoingBullets,
          days: buildCityDays({
            cityId,
            cityName,
            nights: 0,
            multi,
            resolvedTitles,
          }),
        });
      }
    }
  } else if (single) {
    const name =
      String(single.cityFocus || bal?.primary_city || "").trim() ||
      cityNames[0] ||
      single.cityId ||
      "Day city";
    const ids = single.selectedExperienceIds || [];
    const tours: OpsDayTour[] = ids.map((id) => ({
      tourId: id,
      title:
        cleanDisplayTitle(resolvedTitles.get(id) || "", id) ||
        resolvedTitles.get(id) ||
        "Experience",
    }));
    stays.push({
      cityId: String(single.cityId || "single"),
      cityName: name,
      nights: 0,
      dateLabel: formatArrivalDate(bal?.tour_date),
      hotelArrangement: "unset",
      hotelLabel: "Unset",
      localTransitLabel: modeLabel(String(single.transitOption || ""))
        ? `In-city: ${modeLabel(String(single.transitOption || ""))}`
        : "In-city: Unset",
      incomingTitle: transitTitle(single.transitOption),
      incomingBullets: transitBullets({
        mode: single.transitOption,
        cityName: name,
      }),
      days: [
        {
          date: String(bal?.tour_date || "").slice(0, 10),
          dateLabel: formatArrivalDate(bal?.tour_date),
          dayIndex: 1,
          hasCar: false,
          hasGuide: tours.length > 0,
          hasTickets: false,
          tours,
          tickets: [],
        },
      ],
    });
  }

  return {
    arrivalHubLabel,
    arrivalVipLabel,
    departureHubLabel,
    departureDropoffLabel,
    stays,
  };
}

async function resolveTour(
  pb: PocketBase,
  tourId: string
): Promise<{
  title: string;
  code: string;
  access_type: string;
} | null> {
  const id = String(tourId || "").trim();
  if (!id) return null;
  const row = await firstOrNull(() =>
    pb.collection("tours").getOne<{
      id: string;
      title?: string;
      name?: string;
      code?: string;
      tour_code?: string;
      access_type?: string;
      is_self_guided?: boolean;
      description?: string;
    }>(id, { requestKey: null })
  );
  if (!row) return { title: id, code: id, access_type: "" };
  const access = String(row.access_type || "").trim();
  const title = String(row.title || row.name || id).trim() || id;
  // Heuristic fill when catalog access_type empty but title is TeamLab-class
  const inferred =
    access ||
    (experienceNeedsEntryTicket({
      title,
      description: row.description,
      is_self_guided: row.is_self_guided,
    })
      ? "direct_ticket"
      : "");
  return {
    title,
    code: String(row.code || row.tour_code || id).trim() || id,
    access_type: inferred,
  };
}

export async function loadOpsGuestRequirements(
  pb: PocketBase,
  hub: OpsHubRow
): Promise<OpsGuestRequirements> {
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  const detailId = String(
    (hub as OpsHubRow & { detail_id?: string }).detail_id || ""
  ).trim();

  let bal: BalRow | null = null;
  if (detailId) {
    bal = await firstOrNull(() =>
      pb.collection("bookings_and_leads").getOne<BalRow>(detailId, {
        requestKey: null,
      })
    );
  }
  if (!bal && pnr) {
    bal = await firstOrNull(() =>
      pb
        .collection("bookings_and_leads")
        .getFirstListItem<BalRow>(`booking_ref="${pnr}"`, {
          requestKey: null,
        })
    );
  }

  const multi = bal ? asMulti(bal.selections) : null;
  const single = bal ? asSingle(bal.selections) : null;

  let tourTitle = "—";
  let tourCode = "—";
  let startTime = "—";
  let durationLabel = String(bal?.duration_label || "").trim() || "—";
  let tourLanguage = "—";
  let meetingPointName = String(bal?.meeting_point_name || "").trim();
  let meetingPointAddress = String(bal?.meeting_point_address || "").trim();
  let specialMobility = "—";
  const accessLines: OpsAccessLine[] = [];

  const tourIds = tourIdsFromSelections(bal?.selections);
  const resolvedTitles = new Map<string, string>();
  for (const id of tourIds) {
    const t = await resolveTour(pb, id);
    if (!t) continue;
    const clean = cleanDisplayTitle(t.title, id) || t.title;
    resolvedTitles.set(id, clean);
    const scheduled = multi?.experienceSchedule?.find((e) => e.tourId === id);
    if (scheduled?.title) {
      const snap = cleanDisplayTitle(scheduled.title, id);
      if (snap) resolvedTitles.set(id, snap);
    }
    if (
      !experienceNeedsEntryTicket({
        title: clean,
        access_type: t.access_type,
      })
    ) {
      continue;
    }
    const accessType = t.access_type || "direct_ticket";
    accessLines.push({
      tourId: id,
      title: clean,
      accessType,
      label: accessTypeStaffLabel(accessType),
    });
  }

  for (const ticket of multi?.transportTickets || []) {
    const title =
      cleanDisplayTitle(ticket.name, ticket.productId) || ticket.name;
    accessLines.push({
      tourId: `transport:${ticket.productId}`,
      title,
      accessType: ticket.transportType || "other",
      label: formatTransportType(ticket.transportType),
    });
  }
  if (multi?.guestHasICCard === false) {
    accessLines.push({
      tourId: "pass:suica",
      title: "Suica / IC top-up",
      accessType: "suica",
      label: formatTransportType("suica"),
    });
  }

  if (single) {
    const ids = single.selectedExperienceIds || [];
    if (ids[0]) {
      const t = await resolveTour(pb, ids[0]);
      if (t) {
        tourTitle = cleanDisplayTitle(t.title, ids[0]) || t.title;
        tourCode = t.code && t.code !== ids[0] ? t.code : "—";
      }
    }
    startTime = String(single.startHour || "").trim() || "—";
    if (single.tourHours) {
      durationLabel = `${single.tourHours} Hours`;
    } else if (bal?.duration_value) {
      durationLabel = `${bal.duration_value} Hours`;
    }
    tourLanguage =
      String(single.preferredTourLanguage || "").trim() || "—";
    if (!meetingPointName) {
      meetingPointName = String(single.meetingPointName || "").trim();
    }
    if (!meetingPointAddress) {
      meetingPointAddress = String(single.meetingPointAddress || "").trim();
    }
  } else if (multi) {
    const titles = (multi.experienceSchedule || [])
      .map((e) => {
        const snap = cleanDisplayTitle(String(e.title || ""), e.tourId);
        if (snap) return snap;
        return (
          cleanDisplayTitle(resolvedTitles.get(e.tourId) || "", e.tourId) ||
          resolvedTitles.get(e.tourId) ||
          ""
        );
      })
      .filter(Boolean);
    const uniqueTitles = Array.from(new Set(titles));
    if (uniqueTitles.length > 0) {
      tourTitle = uniqueTitles.join(", ");
      tourCode = "—";
    } else {
      const first =
        multi.experienceSchedule?.[0]?.tourId || multi.experienceIds?.[0] || "";
      if (first) {
        const t = await resolveTour(pb, first);
        if (t) {
          tourTitle = cleanDisplayTitle(t.title, first) || t.title;
          tourCode = t.code && t.code !== first ? t.code : "—";
        }
      }
    }
    startTime =
      String(multi.experienceSchedule?.[0]?.date || "").trim() || "—";
    if (multi.durationDays) {
      durationLabel = `${multi.durationDays} Days`;
    } else if (bal?.duration_label) {
      durationLabel = bal.duration_label;
    }
    tourLanguage =
      String(multi.experienceSchedule?.[0]?.language || "").trim() || "—";
    specialMobility = formatNeeds(multi.specialNeeds);
  }

  let specialNotes =
    String(hub.pickup_notes || "").trim() ||
    (typeof bal?.special_requests === "string"
      ? bal.special_requests
      : "") ||
    "";
  if (!specialNotes || specialNotes === "—") {
    specialNotes = "No special requirements specified by client";
  }

  const ticketsNeededFromCatalog = accessLines.length > 0;

  const selObj =
    bal?.selections && typeof bal.selections === "object"
      ? (bal.selections as unknown as Record<string, unknown>)
      : {};

  const guests = bal?.guests || { adults: 0, kids: 0 };
  const adults = Math.max(0, Number(guests.adults) || 0);
  const children = Math.max(0, Number(guests.kids) || 0);
  const infants = Math.max(
    0,
    Number((guests as { infants?: number }).infants) ||
      Number(selObj.infants) ||
      0
  );

  const guestHasJRPass =
    coerceTriBool(multi?.guestHasJRPass) ??
    coerceTriBool(selObj.guestHasJRPass) ??
    coerceTriBool(bal?.guest_has_jr_pass);
  const guestHasICCard =
    coerceTriBool(multi?.guestHasICCard) ??
    coerceTriBool(selObj.guestHasICCard) ??
    coerceTriBool(bal?.guest_has_ic_card);
  const guestNeedsTransitHelp =
    coerceTriBool(multi?.guestNeedsTransitHelp) ??
    coerceTriBool(selObj.guestNeedsTransitHelp) ??
    coerceTriBool(bal?.guest_needs_transit_help);

  const transportStrategy = summarizeTransportStrategy(multi, single);
  const guestName = pickGuestName(bal, selObj);
  const guestEmail = String(bal?.email || "").trim() || "—";
  const guestPhone = pickGuestPhone(bal, selObj);

  const totalDaysLabel =
    durationLabel !== "—"
      ? durationLabel
      : multi?.durationDays
        ? `${multi.durationDays} Days`
        : bal?.duration_value
          ? `${bal.duration_value} Days`
          : "—";
  const arrivalDateLabel = formatArrivalDate(
    bal?.tour_date || hub.tour_date || null
  );
  const travelPaceLabel = formatPaceLabel(
    multi?.pace ?? single?.pace ?? selObj.pace
  );
  const experienceService =
    multi?.experienceService ??
    (typeof selObj.experienceService === "string"
      ? selObj.experienceService
      : null);
  const travelStyle =
    multi?.preEliteTravelStyle ??
    selObj.preEliteTravelStyle ??
    selObj.travelStyle ??
    null;
  const travelVibeLabel = formatTravelVibe({
    experienceService,
    travelStyle,
  });
  const experienceTierLabel = formatExperienceTier(experienceService);
  const interestsLabel = formatInterestsLabel(
    multi?.preEliteInterests ??
      selObj.preEliteInterests ??
      selObj.interests
  );

  const routeTimeline = buildRouteTimeline(
    bal,
    multi,
    single,
    resolvedTitles
  );
  const itineraryStops = routeTimeline.stays;

  const isSingleDayTrip = Boolean(single) && !multi;

  const arrivalFlightLabel = isSingleDayTrip
    ? "-"
    : pickFlightLabel(selObj, [
        "arrivalFlight",
        "arrivalFlightNumber",
        "flightNumber",
      ]);
  const departureFlightLabel = isSingleDayTrip
    ? "-"
    : pickFlightLabel(selObj, [
        "departureFlight",
        "departureFlightNumber",
      ]);

  const hasShinkansen = Boolean(
    multi?.transitByLeg?.some((l) =>
      /public|shinkansen|rail/i.test(String(l.transitType || ""))
    ) ||
      multi?.transportTickets?.some((t) =>
        /shinkansen|rail/i.test(
          `${t.transportType || ""} ${t.name || ""}`
        )
      ) ||
      multi?.locationStops?.some((s) => s.needsTicket && s.ticketType === "shinkansen_reserved")
  );
  const shinkansenLabel = isSingleDayTrip
    ? "-"
    : hasShinkansen
      ? "VIP / reserved Shinkansen seats requested"
      : "Standard subway / train (no reserved Shinkansen flagged)";

  const icCardsLabel =
    guestHasICCard === false || guestNeedsTransitHelp === true
      ? "Suica / PASMO assistance needed"
      : guestHasICCard === true
        ? "Suica / PASMO guest already has IC card"
        : "Suica / PASMO no IC cards requested";

  const chauffeurPickupLabel = isSingleDayTrip
    ? "-"
    : multi?.airportPickup
      ? "Airport chauffeur pickup SET"
      : "(pending confirm)";

  const serviceCount = itineraryStops.reduce(
    (sum, stop) =>
      sum +
      stop.days.reduce((dSum, day) => dSum + day.tours.length, 0),
    0
  );

  if (!meetingPointName || meetingPointName === "—") {
    meetingPointName = "Hotel Lobby (To be confirmed by Concierge)";
  }
  if (!meetingPointAddress || meetingPointAddress === "—") {
    meetingPointAddress = "Coordinates sent upon guide confirmation";
  }
  if (!specialMobility || specialMobility === "—") {
    specialMobility = "No special requirements specified by client";
  }


  // Heal ops_hub / ops_tickets when catalog says tickets but hub still says none.
  if (ticketsNeededFromCatalog && pnr && hub.tickets_needed !== true) {
    try {
      const enriched = await enrichDemandFromTourCatalog(
        pb,
        {
          ticketsNeeded: true,
          driverNeeded: Boolean(hub.driver_needed),
          guideNeeded: true,
          ticketLines: accessLines.map((l) => ({
            tourId: l.tourId,
            name: `${l.title} · ${l.label}`,
            qty: 1,
            accessType: l.accessType,
          })),
        },
        tourIds
      );
      await applyOpsDemandForPnr(pb, pnr, enriched);
    } catch {
      /* non-blocking heal */
    }
  }

  const productLabel = opsProductLabelFromLead({
    type: bal?.type,
    selections: bal?.selections,
    durationLabel: bal?.duration_label || durationLabel,
    durationValue: bal?.duration_value,
  });

  return {
    guestName,
    guestEmail,
    guestPhone,
    adults,
    children,
    infants,
    guestHasJRPass,
    guestHasICCard,
    guestNeedsTransitHelp,
    transportStrategy,
    productLabel,
    totalDaysLabel,
    arrivalDateLabel,
    travelPaceLabel,
    travelVibeLabel,
    interestsLabel,
    experienceTierLabel,
    arrivalHubLabel: routeTimeline.arrivalHubLabel,
    arrivalVipLabel: routeTimeline.arrivalVipLabel,
    departureHubLabel: routeTimeline.departureHubLabel,
    departureDropoffLabel: routeTimeline.departureDropoffLabel,
    arrivalFlightLabel,
    departureFlightLabel,
    shinkansenLabel,
    icCardsLabel,
    chauffeurPickupLabel,
    itineraryStops,
    routeTimeline,
    tourTitle,
    tourCode,
    meetingPointName,
    meetingPointAddress,
    startTime,
    durationLabel: durationLabel || "—",
    tourLanguage,
    specialMobility,
    specialNotes,
    accessLines,
    ticketsNeededFromCatalog,
    serviceCount,
  };
}
