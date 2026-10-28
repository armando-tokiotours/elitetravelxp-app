"use client";

/**
 * Ref-only pre-hydration for the Day-Pass (Single-Day) EDIT builder.
 *
 * Reuses the existing ref-only lookup (`POST /api/itinerary/contact` →
 * `findBookingsAndLeadsByRef`) — the server now returns the same
 * `expandSingleDaySelectionsToState` patch Retrieve / Manage Booking
 * apply, plus an ops_hub payment slice. No parallel fetcher / endpoint.
 *
 * Guarded once-per-ref: repeated store edits, re-renders, or step
 * navigation never re-run it and never clobber in-progress edits.
 * Only a ref *change* (or explicit `force`) hydrates again.
 */

import {
  guestSpecialRequirementsChoicesComplete,
  normalizeGuestSpecialRequirements,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import { clampCustomTourHours, resolveTourHoursTier } from "@/lib/tourHoursTier";
import { TOUR_HOUR_PRESETS } from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { bookingStatusFromPbRecord, normalizeBookingPNR } from "@/utils/pnr";
import { bookingBoundRef } from "@/lib/bookingKindGuard";

export type SingleDayPaymentSlice = {
  feeCreditEur: number;
  totalPaidEur: number;
  estimatedTotalEur: number;
  tourPaymentStatus: string | null;
  conciergeFeePaid: boolean;
  paymentConfirmed: boolean;
};

export type SingleDayRemoteBooking = {
  ref: string;
  type: string | null;
  status: string | null;
  email: string;
  fullName: string;
  singleDay: Record<string, unknown> | null;
  payment: SingleDayPaymentSlice;
};

const EMPTY_PAYMENT: SingleDayPaymentSlice = {
  feeCreditEur: 0,
  totalPaidEur: 0,
  estimatedTotalEur: 0,
  tourPaymentStatus: null,
  conciergeFeePaid: false,
  paymentConfirmed: false,
};

const hydratedRefs = new Set<string>();
const inflight = new Map<string, Promise<SingleDayRemoteBooking | null>>();

export function isSingleDayRefHydrated(ref?: string | null): boolean {
  const bound = bookingBoundRef(ref);
  return bound ? hydratedRefs.has(bound) : false;
}

export async function fetchSingleDayBookingByRef(
  rawRef?: string | null
): Promise<SingleDayRemoteBooking | null> {
  const ref = bookingBoundRef(rawRef);
  if (!ref) return null;
  const res = await fetch("/api/itinerary/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pnr: ref }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    type?: string | null;
    status?: string | null;
    email?: string;
    fullName?: string;
    singleDay?: Record<string, unknown> | null;
    payment?: Partial<SingleDayPaymentSlice> | null;
  };
  if (!data.singleDay && data.type !== "single_day") return null;
  const p = data.payment || {};
  return {
    ref,
    type: data.type || null,
    status: data.status || null,
    email: String(data.email || "").trim().toLowerCase(),
    fullName: String(data.fullName || "").trim(),
    singleDay: data.singleDay || null,
    payment: {
      feeCreditEur: Math.max(0, Math.round(Number(p.feeCreditEur) || 0)),
      totalPaidEur: Math.max(0, Math.round(Number(p.totalPaidEur) || 0)),
      estimatedTotalEur: Math.max(
        0,
        Math.round(Number(p.estimatedTotalEur) || 0)
      ),
      tourPaymentStatus: p.tourPaymentStatus || null,
      conciergeFeePaid: Boolean(p.conciergeFeePaid),
      paymentConfirmed: Boolean(p.paymentConfirmed),
    },
  };
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolOrNull(v: unknown): boolean | null {
  return v === true || v === false ? v : null;
}

/**
 * Apply an expanded single-day patch to the stores.
 * Only keys actually present in the patch are written — absent saved
 * fields never reset values the guest already has locally.
 */
export function applySingleDayBookingPatch(
  booking: SingleDayRemoteBooking
): void {
  const ref = normalizeBookingPNR(booking.ref);
  const patch = booking.singleDay || {};

  // --- Builder S store (the edit surface) ---
  const sd: Record<string, unknown> = {};
  const has = (k: string) => patch[k] !== undefined && patch[k] !== null;

  if (has("tourDate")) {
    const raw = String(patch.tourDate).slice(0, 10);
    sd.tourDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  }
  if (has("cityFocus") && String(patch.cityFocus).trim()) {
    sd.cityFocus = String(patch.cityFocus).trim();
  }
  if (has("adults")) sd.adults = Math.max(1, Math.min(20, num(patch.adults, 1)));
  if (has("children"))
    sd.children = Math.max(0, Math.min(20, num(patch.children, 0)));
  if (has("startTime")) sd.startTime = String(patch.startTime).slice(0, 5);
  if (has("tourHours")) {
    const hours = clampCustomTourHours(num(patch.tourHours, 6));
    sd.tourHours = hours;
    sd.tourHoursCustom = !(TOUR_HOUR_PRESETS as number[]).includes(hours);
    sd.needsAgentConfirmation =
      resolveTourHoursTier(hours).needsAgentConfirmation;
  }
  if (has("travelPace")) {
    sd.travelPace =
      patch.travelPace === "fast" ||
      patch.travelPace === "moderate" ||
      patch.travelPace === "relaxed"
        ? patch.travelPace
        : null;
  } else if ("travelPace" in patch) {
    sd.travelPace = null;
  }
  if (has("guidePreference")) sd.guidePreference = patch.guidePreference;
  if (has("preferredMovement")) sd.preferredMovement = patch.preferredMovement;
  if (has("suicaNeeded")) sd.suicaNeeded = Boolean(patch.suicaNeeded);
  if (has("suicaValueEur")) sd.suicaValueEur = num(patch.suicaValueEur, 15);
  if ("guestHasJRPass" in patch) sd.guestHasJRPass = boolOrNull(patch.guestHasJRPass);
  if ("guestHasICCard" in patch) sd.guestHasICCard = boolOrNull(patch.guestHasICCard);
  if ("guestNeedsTransitHelp" in patch)
    sd.guestNeedsTransitHelp = boolOrNull(patch.guestNeedsTransitHelp);
  if (has("meetingPoint")) sd.meetingPoint = String(patch.meetingPoint);
  if (has("meetingPointName"))
    sd.meetingPointName = String(patch.meetingPointName);
  if ("meetingPointLat" in patch)
    sd.meetingPointLat = patch.meetingPointLat ?? null;
  if ("meetingPointLng" in patch)
    sd.meetingPointLng = patch.meetingPointLng ?? null;
  if (has("meetingPointPlaceId"))
    sd.meetingPointPlaceId = String(patch.meetingPointPlaceId);
  if (has("meetingLogisticsConfirmed"))
    sd.meetingLogisticsConfirmed = Boolean(patch.meetingLogisticsConfirmed);
  if (has("preferredTourLanguage"))
    sd.preferredTourLanguage = String(patch.preferredTourLanguage) || "EN";
  if (Array.isArray(patch.selectedExperiences)) {
    sd.selectedExperiences = patch.selectedExperiences;
    sd.experiencesStepDone = patch.selectedExperiences.length > 0;
  }

  let guestReqs: GuestSpecialRequirements | null = null;
  if (patch.guestSpecialRequirements != null) {
    // Server-expanded patch is authoritative: expand* already resolved
    // BAL top-level / selections / legacy specialNeeds and a present
    // serialized No/No is an explicit answer (same reading Guide Portal
    // uses on the raw DB value). Do NOT migrateUnset here — with
    // acked=false it erased explicit No/No to null/null, so the dossier
    // strip showed "None specified" for guests who had answered.
    // Truly unanswered arrives as null/null (no saved object anywhere)
    // and stays null/null below.
    guestReqs = normalizeGuestSpecialRequirements(
      patch.guestSpecialRequirements
    );
    sd.guestSpecialRequirements = guestReqs;
    // Acked ⇔ both Dietary & Mobility explicitly answered (Yes or No) —
    // same rule the store setters use; an explicit acked flag carried
    // by the expansion wins when present.
    sd.guestSpecialRequirementsAcked =
      patch.guestSpecialRequirementsAcked === true ||
      guestSpecialRequirementsChoicesComplete(guestReqs);
  }
  useSingleDayBuilderStore.setState(sd);

  // --- Shared Builder store: ref lock + the copies BuilderSView reads ---
  // Setting confirmedBookingRef to the URL ref is what makes every
  // existing edit-modal sync (Meeting, Save & View, …) write back to
  // the same PNR instead of a fresh DRAFT- temp ref. No locations /
  // tours are touched, so multi-day state is never wiped.
  const builderPatch: Record<string, unknown> = {
    tripMode: "single_day",
    confirmedBookingRef: ref,
    tempBookingRef: ref,
    bookingStatus: bookingStatusFromPbRecord(
      booking.status || undefined,
      undefined
    ),
  };
  if (typeof sd.adults === "number") builderPatch.adults = sd.adults;
  if (typeof sd.children === "number") builderPatch.children = sd.children;
  if ("travelPace" in patch) builderPatch.travelPace = sd.travelPace ?? null;
  if (guestReqs) {
    builderPatch.guestSpecialRequirements = guestReqs;
    builderPatch.guestSpecialRequirementsAcked =
      sd.guestSpecialRequirementsAcked;
  }
  if (has("preferredTourLanguage"))
    builderPatch.preferredTourLanguage = sd.preferredTourLanguage;
  // Travel Brief (Pre-Elite) — expanded only when the lead carries them;
  // each field applied independently so a partial brief never wipes the
  // others already persisted locally.
  if (
    typeof patch.preEliteTravelStyle === "string" &&
    patch.preEliteTravelStyle
  )
    builderPatch.preEliteTravelStyle = patch.preEliteTravelStyle;
  if (
    Array.isArray(patch.preEliteInterests) &&
    patch.preEliteInterests.length
  )
    builderPatch.preEliteInterests = patch.preEliteInterests.map(String);
  if (typeof patch.preEliteMotivation === "string" && patch.preEliteMotivation)
    builderPatch.preEliteMotivation = patch.preEliteMotivation;
  if (
    Array.isArray(patch.preElitePainPoints) &&
    patch.preElitePainPoints.length
  )
    builderPatch.preElitePainPoints = patch.preElitePainPoints.map(String);
  if (has("meetingPoint")) builderPatch.meetingPoint = sd.meetingPoint;
  if (has("meetingPointName"))
    builderPatch.meetingPointName = sd.meetingPointName;
  if ("meetingPointLat" in patch)
    builderPatch.meetingPointLat = sd.meetingPointLat;
  if ("meetingPointLng" in patch)
    builderPatch.meetingPointLng = sd.meetingPointLng;
  if (has("meetingPointPlaceId"))
    builderPatch.meetingPointPlaceId = sd.meetingPointPlaceId;
  if (has("meetingLogisticsConfirmed"))
    builderPatch.meetingLogisticsConfirmed = sd.meetingLogisticsConfirmed;
  if ("guestHasJRPass" in patch)
    builderPatch.guestHasJRPass = sd.guestHasJRPass;
  if ("guestHasICCard" in patch)
    builderPatch.guestHasICCard = sd.guestHasICCard;
  if ("guestNeedsTransitHelp" in patch)
    builderPatch.guestNeedsTransitHelp = sd.guestNeedsTransitHelp;
  useBuilderStore.setState(builderPatch as never);

  // --- Guest identity for the header badge / save-sync email gate ---
  if (booking.email || booking.fullName) {
    useItineraryStore.setState((s) => ({
      clientEmail: booking.email || s.clientEmail,
      clientName: booking.fullName || s.clientName,
      confirmedBookingRef: ref,
      tempBookingRef: ref,
    }));
  }
}

/**
 * Fetch + apply once per ref. Concurrent callers share one request;
 * a successful hydrate pins the ref so step edits never re-trigger it.
 */
export function hydrateSingleDayBookingByRef(
  rawRef?: string | null,
  opts?: { force?: boolean }
): Promise<SingleDayRemoteBooking | null> {
  const ref = bookingBoundRef(rawRef);
  if (!ref) return Promise.resolve(null);
  if (!opts?.force && hydratedRefs.has(ref)) {
    return inflight.get(ref) ?? Promise.resolve(null);
  }
  const existing = inflight.get(ref);
  if (existing && !opts?.force) return existing;

  const pending = (async () => {
    try {
      await Promise.all([
        Promise.resolve(useBuilderStore.persist.rehydrate()).catch(
          () => undefined
        ),
        Promise.resolve(useSingleDayBuilderStore.persist.rehydrate()).catch(
          () => undefined
        ),
      ]);
      const booking = await fetchSingleDayBookingByRef(ref);
      if (!booking) return null;
      applySingleDayBookingPatch(booking);
      hydratedRefs.add(ref);
      return booking;
    } catch {
      return null;
    }
  })();
  inflight.set(ref, pending);
  void pending.then((b) => {
    if (!b && inflight.get(ref) === pending) inflight.delete(ref);
  });
  return pending;
}

export { EMPTY_PAYMENT as EMPTY_SINGLE_DAY_PAYMENT };
