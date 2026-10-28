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
  duration_label?: string;
  cities_list?: string;
  email_sent_count?: number;
  save_version?: number;
  first_email_sent_at?: string;
  last_email_sent_at?: string;
  last_saved_at?: string;
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

/** Guest contact for Ops — Pre-Elite / itinerary profile is the source of truth. */
async function resolveGuestContact(opts?: {
  guestName?: string;
  whatsapp?: string;
}): Promise<{ guestName: string; whatsapp: string }> {
  let guestName = String(opts?.guestName || "").trim();
  let whatsapp = String(opts?.whatsapp || "").trim();
  if ((!guestName || !whatsapp) && typeof window !== "undefined") {
    try {
      const { usePreBuilderStore } = await import("@/store/usePreBuilderStore");
      const pre = usePreBuilderStore.getState();
      if (!guestName) {
        guestName = String(
          pre.fullName || pre.lastPayload?.fullName || ""
        ).trim();
      }
      if (!whatsapp) {
        whatsapp = String(
          pre.whatsapp || pre.lastPayload?.whatsapp || ""
        ).trim();
      }
    } catch {
      /* SSR / store unavailable */
    }
  }
  return { guestName, whatsapp };
}

/** Embed contact keys Ops Guest Requirements already knows how to read. */
function withGuestContactSelections(
  selections: Record<string, unknown>,
  contact: { guestName: string; whatsapp: string }
): Record<string, unknown> {
  const next = { ...selections };
  if (contact.guestName) {
    next.guestName = contact.guestName;
    next.fullName = contact.guestName;
    next.contactName = contact.guestName;
  }
  if (contact.whatsapp) {
    next.whatsapp = contact.whatsapp;
    next.guestPhone = contact.whatsapp;
    next.contactPhone = contact.whatsapp;
  }
  return next;
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

/**
 * Fire-and-forget (or awaited) multi-day draft flush used by Builder M
 * modal Done / Save & View. No-ops without email+ref — never fakes success.
 */
export async function persistMultiDayDraft(opts?: {
  cityNames?: Record<string, string>;
  status?: BookingLeadStatus;
  quote?: QuoteSlice;
}): Promise<{ ok: boolean; reason?: string; bookingRef?: string }> {
  const [{ useBuilderStore }, { useItineraryStore }, { usePreBuilderStore }] =
    await Promise.all([
      import("@/store/useBuilderStore"),
      import("@/store/useItineraryStore"),
      import("@/store/usePreBuilderStore"),
    ]);
  const builder = useBuilderStore.getState();
  const bookingRef = normalizeRef(
    builder.confirmedBookingRef || builder.tempBookingRef || ""
  );
  const email = String(
    useItineraryStore.getState().clientEmail ||
      usePreBuilderStore.getState().email ||
      usePreBuilderStore.getState().lastPayload?.email ||
      ""
  )
    .trim()
    .toLowerCase();
  if (!bookingRef) return { ok: false, reason: "missing_ref" };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "missing_email", bookingRef };
  }
  const ok = await syncMultiDayBookingLead({
    bookingRef,
    email,
    state: builder,
    cityNames: opts?.cityNames,
    status: opts?.status || "lead",
    quote: opts?.quote,
  });
  return { ok, reason: ok ? undefined : "upsert_failed", bookingRef };
}

export async function syncMultiDayBookingLead(opts: {
  bookingRef: string;
  email: string;
  state: BuilderState;
  cityNames?: Record<string, string>;
  status?: BookingLeadStatus;
  dossierPdfUrl?: string | null;
  quote?: QuoteSlice;
  guestName?: string;
  whatsapp?: string;
}): Promise<boolean> {
  const email = String(opts.email || "").trim().toLowerCase();
  const bookingRef = normalizeRef(opts.bookingRef);
  if (!email || !bookingRef) return false;

  // PB date fields reject / re-emit full datetimes — always bare YYYY-MM-DD.
  const arrivalYmd = String(opts.state.arrivalDate || "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;

  const primaryCity = primaryCityFromMultiDay(opts.state, opts.cityNames);
  const stayOnly = (opts.state.locations || []).filter(
    (l) =>
      (!l.visitType || l.visitType === "stay") &&
      !l.isTransitHub &&
      l.cityId
  );
  const cityNamesList = stayOnly
    .map((l) => opts.cityNames?.[l.cityId] || "")
    .filter(Boolean);
  if (!cityNamesList.length && primaryCity) cityNamesList.push(primaryCity);
  const guests = {
    adults: opts.state.adults,
    kids: opts.state.children,
  };
  const contact = await resolveGuestContact({
    guestName: opts.guestName,
    whatsapp: opts.whatsapp,
  });
  const selections = withGuestContactSelections(
    buildMultiDaySelections(opts.state, {
      cityNames: opts.cityNames,
    }) as unknown as Record<string, unknown>,
    contact
  );
  const q = quoteFields(opts.quote);
  const status = opts.status || "lead";
  const { demandFromMultiDay } = await import("@/lib/opsDemand");
  const demand = demandFromMultiDay(opts.state);

  cacheBookingLeadLocally({
    booking_ref: bookingRef,
    email,
    type: "multi_day",
    status,
    primary_city: primaryCity,
    tour_date: arrivalYmd,
    guests,
    duration_value: opts.state.durationDays,
    cities_list: cityNamesList.join(", "),
    selections,
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
        tourDate: arrivalYmd,
        guests,
        durationValue: opts.state.durationDays,
        citiesList: cityNamesList.join(", "),
        cityNames: cityNamesList,
        selections: {
          ...selections,
          ...q,
        },
        guestName: contact.guestName || undefined,
        whatsapp: contact.whatsapp || undefined,
        guestSpecialRequirements: selections.guestSpecialRequirements,
        dossierPdfUrl: opts.dossierPdfUrl ?? null,
        demand,
        meetingPointName:
          opts.state.meetingPointName || opts.state.meetingPoint || "",
        meetingPointAddress: opts.state.meetingPoint || "",
        meetingPointLat: opts.state.meetingPointLat ?? null,
        meetingPointLng: opts.state.meetingPointLng ?? null,
        meetingPointPlaceId: opts.state.meetingPointPlaceId || "",
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
  /** Pre-Elite brief fields live on useBuilderStore, not the single-day store. */
  preEliteTravelStyle?: string | null;
  preEliteInterests?: string[];
  preEliteMotivation?: string | null;
  preElitePainPoints?: string[];
  status?: BookingLeadStatus;
  dossierPdfUrl?: string | null;
  quote?: QuoteSlice;
  guestName?: string;
  whatsapp?: string;
}): Promise<boolean> {
  const email = String(opts.email || "").trim().toLowerCase();
  const bookingRef = normalizeRef(opts.bookingRef);
  if (!email || !bookingRef) return false;

  const guests = {
    adults: opts.state.adults,
    kids: opts.state.children,
  };
  // Pre-Elite brief fields live on useBuilderStore. Callers that don't
  // pass them explicitly (autosave, payment, guests modal…) must not
  // wipe the brief already saved in selections — fall back to the live
  // builder store, exactly where the Travel Brief modal writes them.
  let preEliteFallback: {
    preEliteTravelStyle?: string | null;
    preEliteInterests?: string[];
    preEliteMotivation?: string | null;
    preElitePainPoints?: string[];
  } = {};
  if (
    opts.preEliteTravelStyle === undefined ||
    opts.preEliteInterests === undefined ||
    opts.preEliteMotivation === undefined ||
    opts.preElitePainPoints === undefined
  ) {
    try {
      const { useBuilderStore } = await import("@/store/useBuilderStore");
      const b = useBuilderStore.getState();
      preEliteFallback = {
        preEliteTravelStyle: b.preEliteTravelStyle,
        preEliteInterests: b.preEliteInterests,
        preEliteMotivation: b.preEliteMotivation,
        preElitePainPoints: b.preElitePainPoints,
      };
    } catch {
      /* keep null/[] defaults below */
    }
  }
  const contact = await resolveGuestContact({
    guestName: opts.guestName,
    whatsapp: opts.whatsapp,
  });
  const selections = withGuestContactSelections(
    buildSingleDaySelections({
      ...opts.state,
      cityId: opts.cityId,
      preEliteTravelStyle:
        opts.preEliteTravelStyle ??
        preEliteFallback.preEliteTravelStyle ??
        null,
      preEliteInterests:
        opts.preEliteInterests ?? preEliteFallback.preEliteInterests ?? [],
      preEliteMotivation:
        opts.preEliteMotivation ?? preEliteFallback.preEliteMotivation ?? null,
      preElitePainPoints:
        opts.preElitePainPoints ?? preEliteFallback.preElitePainPoints ?? [],
    }) as unknown as Record<string, unknown>,
    contact
  );
  const q = quoteFields(opts.quote);
  const status = opts.status || "lead";
  const { demandFromSingleDay } = await import("@/lib/opsDemand");
  const demand = demandFromSingleDay(opts.state);

  cacheBookingLeadLocally({
    booking_ref: bookingRef,
    email,
    type: "single_day",
    status,
    primary_city: opts.state.cityFocus,
    tour_date: opts.state.tourDate,
    guests,
    duration_value: opts.state.tourHours,
    cities_list: opts.state.cityFocus || "",
    selections,
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
        citiesList: opts.state.cityFocus || "",
        cityNames: opts.state.cityFocus ? [opts.state.cityFocus] : [],
        selections: {
          ...selections,
          ...q,
        },
        guestName: contact.guestName || undefined,
        whatsapp: contact.whatsapp || undefined,
        guestSpecialRequirements: selections.guestSpecialRequirements,
        dossierPdfUrl: opts.dossierPdfUrl ?? null,
        demand,
        meetingPointName:
          opts.state.meetingPointName || opts.state.meetingPoint || "",
        meetingPointAddress: opts.state.meetingPoint || "",
        meetingPointLat: opts.state.meetingPointLat ?? null,
        meetingPointLng: opts.state.meetingPointLng ?? null,
        meetingPointPlaceId: opts.state.meetingPointPlaceId || "",
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
