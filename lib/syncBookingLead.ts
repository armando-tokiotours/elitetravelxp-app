/**
 * Client helpers to sync Builder M / Builder S into PocketBase
 * `bookings_and_leads` + localStorage cache for instant Admin rows.
 */

import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import {
  buildMultiDaySelections,
  buildSingleDaySelections,
  primaryCityFromMultiDay,
  type BookingLeadStatus,
  type BookingLeadType,
} from "@/lib/bookingsAndLeads";

/** Admin merge/dedupe reads both keys (tokio preferred, travelxp legacy). */
export const LOCAL_LEADS_STORAGE_KEYS = [
  "tokio_saved_leads",
  "travelxp_saved_leads",
] as const;

export type CachedBookingLead = {
  id?: string;
  booking_ref: string;
  email: string;
  type: BookingLeadType;
  status?: BookingLeadStatus | string;
  primary_city?: string;
  tour_date?: string | null;
  guests?: { adults: number; kids: number };
  duration_value?: number;
  quote_min?: number;
  quote_max?: number;
  selections?: Record<string, unknown>;
  created?: string;
  updated?: string;
};

function normalizeRef(ref: string): string {
  return String(ref || "")
    .trim()
    .toUpperCase();
}

function readLeadList(raw: string | null): CachedBookingLead[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
    return list.filter(
      (item): item is CachedBookingLead =>
        Boolean(item) && typeof item === "object"
    );
  } catch {
    return [];
  }
}

/**
 * Dual-write local cache so Admin can show the row immediately
 * (before PocketBase list re-indexes). Dedupes by booking_ref.
 */
export function cacheBookingLeadLocally(lead: CachedBookingLead): void {
  if (typeof window === "undefined") return;
  const booking_ref = normalizeRef(lead.booking_ref);
  const email = String(lead.email || "")
    .trim()
    .toLowerCase();
  if (!booking_ref) return;

  const now = new Date().toISOString();
  const entry: CachedBookingLead = {
    ...lead,
    id: lead.id || `local-${booking_ref}`,
    booking_ref,
    email: email || String(lead.email || ""),
    created: lead.created || now,
    updated: now,
  };

  for (const key of LOCAL_LEADS_STORAGE_KEYS) {
    try {
      const existing = readLeadList(window.localStorage.getItem(key));
      const next = [
        entry,
        ...existing.filter(
          (r) => normalizeRef(String(r.booking_ref || "")) !== booking_ref
        ),
      ].slice(0, 200);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }
}

/** Patch status (and optional fields) on every local lead cache key. */
export function patchLocalLeadStatus(
  bookingRef: string,
  status: BookingLeadStatus | string,
  patch?: Partial<CachedBookingLead>
): void {
  if (typeof window === "undefined") return;
  const ref = normalizeRef(bookingRef);
  if (!ref) return;
  const now = new Date().toISOString();

  for (const key of LOCAL_LEADS_STORAGE_KEYS) {
    try {
      const existing = readLeadList(window.localStorage.getItem(key));
      let changed = false;
      const next = existing.map((r) => {
        if (normalizeRef(String(r.booking_ref || "")) !== ref) return r;
        changed = true;
        return {
          ...r,
          ...patch,
          status,
          updated: now,
        };
      });
      if (changed) {
        window.localStorage.setItem(key, JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }
  }
}

type QuoteSlice = { min?: number; max?: number } | null | undefined;

function quoteFields(quote?: QuoteSlice): {
  quote_min?: number;
  quote_max?: number;
} {
  if (!quote) return {};
  const min = Number(quote.min);
  const max = Number(quote.max);
  return {
    ...(Number.isFinite(min) && min > 0 ? { quote_min: Math.round(min) } : {}),
    ...(Number.isFinite(max) && max > 0 ? { quote_max: Math.round(max) } : {}),
  };
}

export async function syncMultiDayBookingLead(opts: {
  bookingRef: string;
  email: string;
  state: BuilderState;
  cityNames?: Record<string, string>;
  status?: BookingLeadStatus;
  dossierPdfUrl?: string | null;
  quote?: QuoteSlice;
}): Promise<boolean> {
  const email = String(opts.email || "").trim().toLowerCase();
  const bookingRef = normalizeRef(opts.bookingRef);
  if (!email || !bookingRef) return false;

  const primaryCity = primaryCityFromMultiDay(opts.state, opts.cityNames);
  const guests = {
    adults: opts.state.adults,
    kids: opts.state.children,
  };
  const selections = buildMultiDaySelections(opts.state);
  const q = quoteFields(opts.quote);
  const status = opts.status || "lead";

  cacheBookingLeadLocally({
    booking_ref: bookingRef,
    email,
    type: "multi_day",
    status,
    primary_city: primaryCity,
    tour_date: opts.state.arrivalDate,
    guests,
    duration_value: opts.state.durationDays,
    selections: selections as unknown as Record<string, unknown>,
    ...q,
  });

  try {
    const res = await fetch("/api/bookings-and-leads/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingRef,
        email,
        type: "multi_day",
        status,
        primaryCity,
        tourDate: opts.state.arrivalDate,
        guests,
        durationValue: opts.state.durationDays,
        selections: {
          ...selections,
          ...q,
        },
        dossierPdfUrl: opts.dossierPdfUrl ?? null,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.error(
        "[syncMultiDayBookingLead] PocketBase upsert failed:",
        res.status,
        body.error || res.statusText
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[syncMultiDayBookingLead] network error:", err);
    return false;
  }
}

export async function syncSingleDayBookingLead(opts: {
  bookingRef: string;
  email: string;
  state: SingleDayBuilderState;
  cityId?: string;
  status?: BookingLeadStatus;
  dossierPdfUrl?: string | null;
  quote?: QuoteSlice;
}): Promise<boolean> {
  const email = String(opts.email || "").trim().toLowerCase();
  const bookingRef = normalizeRef(opts.bookingRef);
  if (!email || !bookingRef) return false;

  const guests = {
    adults: opts.state.adults,
    kids: opts.state.children,
  };
  const selections = buildSingleDaySelections({
    ...opts.state,
    cityId: opts.cityId,
  });
  const q = quoteFields(opts.quote);
  const status = opts.status || "lead";

  cacheBookingLeadLocally({
    booking_ref: bookingRef,
    email,
    type: "single_day",
    status,
    primary_city: opts.state.cityFocus,
    tour_date: opts.state.tourDate,
    guests,
    duration_value: opts.state.tourHours,
    selections: selections as unknown as Record<string, unknown>,
    ...q,
  });

  try {
    const res = await fetch("/api/bookings-and-leads/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingRef,
        email,
        type: "single_day",
        status,
        primaryCity: opts.state.cityFocus,
        tourDate: opts.state.tourDate,
        guests,
        durationValue: opts.state.tourHours,
        selections: {
          ...selections,
          ...q,
        },
        dossierPdfUrl: opts.dossierPdfUrl ?? null,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.error(
        "[syncSingleDayBookingLead] PocketBase upsert failed:",
        res.status,
        body.error || res.statusText
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[syncSingleDayBookingLead] network error:", err);
    return false;
  }
}

/**
 * Unified initial registration + incremental upsert (Builder M / S).
 * Creates with status "lead" when the row is new; PATCHes thereafter.
 */
export async function saveOrUpdateBooking(opts: {
  pnr: string;
  email: string;
  builderType: BookingLeadType;
  status?: BookingLeadStatus;
  /** Multi-day builder state */
  multiDayState?: BuilderState;
  /** Single-day builder state */
  singleDayState?: SingleDayBuilderState;
  cityNames?: Record<string, string>;
  cityId?: string;
  quote?: QuoteSlice;
}): Promise<boolean> {
  const cleanPnr = normalizeRef(opts.pnr);
  const cleanEmail = String(opts.email || "")
    .trim()
    .toLowerCase();
  if (!cleanPnr || !cleanEmail) return false;

  if (opts.builderType === "single_day") {
    const state =
      opts.singleDayState ||
      (await import("@/store/useSingleDayBuilderStore")).useSingleDayBuilderStore.getState();
    return syncSingleDayBookingLead({
      bookingRef: cleanPnr,
      email: cleanEmail,
      state,
      cityId: opts.cityId,
      status: opts.status || "lead",
      quote: opts.quote,
    });
  }

  const state =
    opts.multiDayState ||
    (await import("@/store/useBuilderStore")).useBuilderStore.getState();
  return syncMultiDayBookingLead({
    bookingRef: cleanPnr,
    email: cleanEmail,
    state,
    cityNames: opts.cityNames,
    status: opts.status || "lead",
    quote: opts.quote,
  });
}
