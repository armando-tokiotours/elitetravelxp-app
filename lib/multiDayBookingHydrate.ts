"use client";

/**
 * Ref-only pre-hydration for the Grand Japan Journey (Multi-Day) builder
 * and itinerary — parity with `singleDayBookingHydrate.ts`.
 *
 * Reuses `POST /api/itinerary/contact` (findBookingsAndLeadsByRef); the
 * server returns the same `expandMultiDaySelectionsToState` patch that
 * Retrieve / Manage Booking apply. Guarded once-per-ref so edits and
 * navigation never re-run it or clobber in-progress changes.
 */

import {
  mergePersistedBuilderState,
  normalizeDateIso,
  useBuilderStore,
} from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { bookingStatusFromPbRecord, normalizeBookingPNR } from "@/utils/pnr";
import { bookingBoundRef } from "@/lib/bookingKindGuard";

export type MultiDayPaymentSlice = {
  feeCreditEur: number;
  totalPaidEur: number;
  estimatedTotalEur: number;
  tourPaymentStatus: string | null;
  conciergeFeePaid: boolean;
  paymentConfirmed: boolean;
};

export type MultiDayRemoteBooking = {
  ref: string;
  type: string | null;
  status: string | null;
  email: string;
  fullName: string;
  multiDay: Record<string, unknown> | null;
  payment: MultiDayPaymentSlice;
};

const EMPTY_PAYMENT: MultiDayPaymentSlice = {
  feeCreditEur: 0,
  totalPaidEur: 0,
  estimatedTotalEur: 0,
  tourPaymentStatus: null,
  conciergeFeePaid: false,
  paymentConfirmed: false,
};

const hydratedRefs = new Set<string>();
const inflight = new Map<string, Promise<MultiDayRemoteBooking | null>>();

export function isMultiDayRefHydrated(ref?: string | null): boolean {
  const bound = bookingBoundRef(ref);
  return bound ? hydratedRefs.has(bound) : false;
}

export async function fetchMultiDayBookingByRef(
  rawRef?: string | null
): Promise<MultiDayRemoteBooking | null> {
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
    multiDay?: Record<string, unknown> | null;
    payment?: Partial<MultiDayPaymentSlice> | null;
  };
  if (!data.multiDay && data.type !== "multi_day") return null;
  const p = data.payment || {};
  return {
    ref,
    type: data.type || null,
    status: data.status || null,
    email: String(data.email || "").trim().toLowerCase(),
    fullName: String(data.fullName || "").trim(),
    multiDay: data.multiDay || null,
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

export { EMPTY_PAYMENT as EMPTY_MULTI_DAY_PAYMENT };

/** Apply only keys present in the expanded patch (absent = don't reset). */
export function applyMultiDayBookingPatch(booking: MultiDayRemoteBooking): void {
  const ref = normalizeBookingPNR(booking.ref);
  const patch = booking.multiDay || {};
  const present: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) present[k] = v;
  }
  // Parity with applySingleDayBookingPatch: sanitize the arrival date and
  // never let a missing/invalid one erase a locally chosen date.
  if ("arrivalDate" in present) {
    const ymd = normalizeDateIso(present.arrivalDate);
    if (ymd) present.arrivalDate = ymd;
    else delete present.arrivalDate;
  }
  // Route through the shared merge (same path as localStorage rehydrate /
  // Manage My Booking) so locations, cityHotels, pace and guests are
  // normalized instead of raw-spread into the store.
  useBuilderStore.setState((s) => ({
    ...mergePersistedBuilderState(present, s),
    tripMode: "multi_day",
    confirmedBookingRef: ref,
    tempBookingRef: ref,
    bookingStatus: bookingStatusFromPbRecord(booking.status || undefined, undefined),
  }));

  if (booking.email || booking.fullName) {
    useItineraryStore.setState((s) => ({
      clientEmail: booking.email || s.clientEmail,
      clientName: booking.fullName || s.clientName,
      confirmedBookingRef: ref,
      tempBookingRef: ref,
    }));
  }
}

export function hydrateMultiDayBookingByRef(
  rawRef?: string | null,
  opts?: { force?: boolean }
): Promise<MultiDayRemoteBooking | null> {
  const ref = bookingBoundRef(rawRef);
  if (!ref) return Promise.resolve(null);
  if (!opts?.force && hydratedRefs.has(ref)) {
    return inflight.get(ref) ?? Promise.resolve(null);
  }
  const existing = inflight.get(ref);
  if (existing && !opts?.force) return existing;

  const pending = (async () => {
    try {
      await Promise.resolve(useBuilderStore.persist.rehydrate()).catch(
        () => undefined
      );
      // Local-wins guard (parity with the Single-Day itinerary page):
      // when this device's persisted builder is already bound to this
      // exact PNR and holds a real trip (arrival date chosen), its edits
      // may not have been synced to PocketBase yet — a server refetch
      // here (e.g. opening the itinerary from the builder) must never
      // clobber them with the last saved row. `force` bypasses this.
      if (!opts?.force) {
        const local = useBuilderStore.getState();
        const localRef =
          bookingBoundRef(local.confirmedBookingRef) ??
          bookingBoundRef(local.tempBookingRef);
        if (localRef === ref && local.arrivalDate) {
          hydratedRefs.add(ref);
          return null;
        }
      }
      const booking = await fetchMultiDayBookingByRef(ref);
      if (!booking) return null;
      applyMultiDayBookingPatch(booking);
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
