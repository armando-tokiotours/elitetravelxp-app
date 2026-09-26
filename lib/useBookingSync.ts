/**
 * Booking sync / full restart helpers for Builder M + S + Pre-Elite.
 * "Start another brief" / "Restart New Booking" → purge, mint JPN- PNR,
 * return to landing (no auto-email in draft — use Save & Email).
 */

import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useQuizStore } from "@/store/useQuizStore";
import { activeBookingRef, generateConfirmedPNR } from "@/utils/pnr";
import {
  cacheBookingLeadLocally,
  LOCAL_LEADS_STORAGE_KEYS,
  saveOrUpdateBooking,
  syncMultiDayBookingLead,
  syncSingleDayBookingLead,
} from "@/lib/syncBookingLead";

/** Zustand persist keys + related draft caches. */
export const BOOKING_STORAGE_KEYS = [
  "elite-travel-builder",
  "single-day-builder",
  "travelxp-itinerary-profile",
  "pre-elite-builder",
  "quiz_storage",
] as const;

/** Admin dual-write cache — never wipe on booking restart. */
const PRESERVED_STORAGE_KEYS = new Set<string>([
  ...LOCAL_LEADS_STORAGE_KEYS,
  "elite-team-auth",
]);

export type BookingIdentitySnapshot = {
  email: string;
  customerName: string;
  priorRef: string;
  tourType: "single_day" | "multi_day";
  tourDate: string | null;
  adults: number;
  children: number;
};

/** Capture guest identity before wiping local state. */
export function captureBookingIdentity(): BookingIdentitySnapshot {
  const b = useBuilderStore.getState();
  const it = useItineraryStore.getState();
  const s = useSingleDayBuilderStore.getState();
  const pre = usePreBuilderStore.getState();

  const email = (
    it.clientEmail ||
    pre.email ||
    pre.lastPayload?.email ||
    ""
  )
    .trim()
    .toLowerCase();
  const customerName = (
    it.clientName ||
    pre.fullName ||
    pre.lastPayload?.fullName ||
    ""
  ).trim();
  const priorRef = activeBookingRef({
    tempBookingRef: b.tempBookingRef,
    confirmedBookingRef: b.confirmedBookingRef,
    bookingStatus: b.bookingStatus,
  });
  const tourType =
    b.tripMode === "single_day" || Boolean(s.tourDate)
      ? "single_day"
      : "multi_day";

  return {
    email,
    customerName,
    priorRef,
    tourType,
    tourDate: tourType === "single_day" ? s.tourDate : b.arrivalDate,
    adults: tourType === "single_day" ? s.adults : b.adults,
    children: tourType === "single_day" ? s.children : b.children,
  };
}

/** Purge booking-related localStorage + sessionStorage keys. */
export function clearPersistedBookingStorage(): void {
  if (typeof window === "undefined") return;

  for (const key of BOOKING_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  // Also clear any zustand persist wrappers / draft caches
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (PRESERVED_STORAGE_KEYS.has(k)) continue;
      if (
        /builder|itinerary|pre-elite|booking|pnr|travelxp|quiz_storage|quiz/i.test(
          k
        )
      ) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }

  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

/** Reset in-memory zustand stores (after storage purge). */
export function resetInMemoryBookingStores(): void {
  useQuizStore.getState().reset();
  useItineraryStore.getState().reset();
  useSingleDayBuilderStore.getState().reset();
  usePreBuilderStore.getState().reset();
  useBuilderStore.getState().reset();
  // Belt-and-suspenders: force Match Quiz + profile to absolute zero
  useQuizStore.getState().clearQuiz();
  useBuilderStore.setState({ experienceProfile: null });
  useItineraryStore.getState().clearUserProfile();
}

/** Assign a brand-new official JPN- booking reference on a clean canvas. */
export function mintFreshBookingRef(): string {
  const newRef = generateConfirmedPNR();
  useBuilderStore.setState({
    tempBookingRef: "",
    confirmedBookingRef: newRef,
    bookingStatus: "in_progress",
  });
  useItineraryStore.getState().confirmBookingRef(newRef, "in_progress");
  return newRef;
}

/**
 * Email manage-link for the NEW booking ref (amber gold in HTML template).
 * Soft-fails so reset still completes.
 */
export async function emailNewBookingAccessLink(opts: {
  email: string;
  bookingRef: string;
  customerName?: string;
  tourType?: "single_day" | "multi_day";
  tourDate?: string | null;
  adults?: number;
  children?: number;
}): Promise<{ sent: boolean; error?: string }> {
  if (!opts.email || !opts.bookingRef) {
    return { sent: false, error: "Missing email or booking reference." };
  }
  try {
    const res = await fetch("/api/send-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: opts.email,
        bookingRef: opts.bookingRef,
        customerName: opts.customerName || undefined,
        tourType: opts.tourType,
        tourDate: opts.tourDate,
        adults: opts.adults,
        children: opts.children,
        pdfBase64: "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    if (!res.ok || !data.success) {
      return {
        sent: false,
        error: data.error || "Could not email access link.",
      };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email failed.",
    };
  }
}

export type FullBookingResetResult = {
  newRef: string;
  priorRef: string;
  emailSent: boolean;
  emailError?: string;
  email: string;
};

/**
 * Full restart: capture identity → purge storage/stores → mint JPN- PNR.
 * Does not auto-email during draft/reset — guest must Save & Email explicitly.
 */
export async function performFullBookingReset(): Promise<FullBookingResetResult> {
  const identity = captureBookingIdentity();

  clearPersistedBookingStorage();
  resetInMemoryBookingStores();
  // Storage purge can race with zustand rehydrate — force-clear again after reset
  clearPersistedBookingStorage();

  const newRef = mintFreshBookingRef();

  return {
    newRef,
    priorRef: identity.priorRef,
    emailSent: false,
    email: identity.email,
  };
}

/** Hook-style alias surface for callers expecting `useBookingSync`. */
export function useBookingSync() {
  return {
    captureBookingIdentity,
    clearPersistedBookingStorage,
    resetInMemoryBookingStores,
    mintFreshBookingRef,
    emailNewBookingAccessLink,
    performFullBookingReset,
    /** Dual-write Builder M → PocketBase + localStorage. */
    syncMultiDayBookingLead,
    /** Dual-write Builder S → PocketBase + localStorage. */
    syncSingleDayBookingLead,
    /** Unified create-or-update (status lead on first write). */
    saveOrUpdateBooking,
    /** Local-only cache (e.g. after server upsert already ran). */
    cacheBookingLeadLocally,
  };
}
