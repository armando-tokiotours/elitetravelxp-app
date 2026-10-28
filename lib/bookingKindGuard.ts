/**
 * Booking-bound builder guard.
 *
 * A booking-bound ref (official JPN-/TK- PNR, not a DRAFT-/TMP- temp ref)
 * owns the builder mode: a `single_day` bookings_and_leads row must never
 * render the Grand Japan Journey (multi-day) builder/menu, and vice versa.
 * Fresh trips with no bound ref keep whichever builder the guest opened.
 *
 * Source of truth, in order:
 *  1. `bookings_and_leads.type` for the PNR via the existing ref-only
 *     contact lookup (`POST /api/itinerary/contact` →
 *     `findBookingsAndLeadsByRef`) — the same lookup Send/Print prefill
 *     already uses; no new PocketBase query path is invented here.
 *  2. Local signals for that exact PNR (Pre-Elite brief tripType, the
 *     local saved-leads cache written by builder sync, then the builder
 *     store's `tripMode` when its confirmed ref matches).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSingleDayBookingType,
  isExperienceOnlyBookingType,
  journeyBuilderHref,
  type JourneyBookingKind,
} from "@/lib/builderRoutes";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

export type JourneyKindGuardStatus = "checking" | "ok" | "redirecting";

/** Official PNR bound to a saved booking (temp DRAFT-/TMP- refs excluded). */
export function bookingBoundRef(raw?: string | null): string | null {
  const ref = normalizeBookingPNR(String(raw || ""));
  if (!ref || isTempBookingRef(ref) || !isValidBookingPNR(ref)) return null;
  return ref;
}

function kindFromToken(v?: string | null): JourneyBookingKind | null {
  if (isSingleDayBookingType(v)) return "single_day";
  if (isExperienceOnlyBookingType(v)) return "experience_only";
  const t = String(v || "").trim().toLowerCase().replace(/-/g, "_");
  if (t === "multi_day" || t === "multi" || t === "journey") return "multi_day";
  return null;
}

type LocalKind = { kind: JourneyBookingKind; source: "pre" | "lead" | "store" };

function localKindForRef(ref: string): LocalKind | null {
  // Pre-Elite brief held for this exact PNR.
  try {
    const pre = usePreBuilderStore.getState();
    const preRef = normalizeBookingPNR(
      String(pre.bookingRef || pre.lastPayload?.bookingRef || "")
    );
    if (preRef === ref) {
      const kind = kindFromToken(pre.tripType);
      if (kind) return { kind, source: "pre" };
    }
  } catch {
    /* ignore */
  }

  // Local saved-leads cache (keys mirror LOCAL_LEADS_STORAGE_KEYS in
  // lib/syncBookingLead, written by builder save/sync on this device).
  try {
    for (const key of ["tokio_saved_leads", "travelxp_saved_leads"]) {
      const list = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as { booking_ref?: string; type?: string };
        if (normalizeBookingPNR(String(row.booking_ref || "")) !== ref) {
          continue;
        }
        const kind = kindFromToken(row.type);
        if (kind) return { kind, source: "lead" };
      }
    }
  } catch {
    /* ignore */
  }

  // Builder store — only when the loaded/confirmed booking is this PNR.
  // Weakest signal: an older session may have flipped tripMode, so callers
  // still verify this one against bookings_and_leads.
  try {
    const builder = useBuilderStore.getState();
    if (
      builder.confirmedBookingRef &&
      normalizeBookingPNR(builder.confirmedBookingRef) === ref
    ) {
      const kind = kindFromToken(builder.tripMode);
      if (kind) return { kind, source: "store" };
    }
  } catch {
    /* ignore */
  }
  return null;
}

const remoteKindCache = new Map<string, Promise<JourneyBookingKind | null>>();

/** bookings_and_leads.type for a PNR via the existing contact lookup. */
export function fetchJourneyKindForRef(
  ref: string
): Promise<JourneyBookingKind | null> {
  const bound = bookingBoundRef(ref);
  if (!bound) return Promise.resolve(null);
  const cached = remoteKindCache.get(bound);
  if (cached) return cached;
  const pending = (async () => {
    try {
      const res = await fetch("/api/itinerary/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr: bound }),
      });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as {
        type?: string | null;
      };
      return kindFromToken(data.type);
    } catch {
      return null;
    }
  })();
  remoteKindCache.set(bound, pending);
  // Failed/unknown lookups may succeed later (PB back up) — don't pin them.
  void pending.then((kind) => {
    if (!kind) remoteKindCache.delete(bound);
  });
  return pending;
}

/**
 * Enforce that the builder on screen matches the bound booking's kind.
 * Redirects (preserving `?ref=`) to the canonical builder for the booking
 * and repairs `useBuilderStore.tripMode` so menu/stepper chrome
 * (AppSidebar, BottomNav, AppNavDock, ProgressBar selection) follows.
 * No bound ref → simply adopts `expected` (intentional fresh trip).
 */
export function useJourneyKindGuard(
  expected: "multi_day" | "single_day",
  explicitRef?: string | null,
  opts?: {
    /** Redirect target for a mismatched booking (default: its builder). */
    redirectHref?: (ref: string, kind: JourneyBookingKind) => string;
  }
): { status: JourneyKindGuardStatus; boundRef: string | null } {
  const router = useRouter();
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const setTripMode = useBuilderStore((s) => s.setTripMode);
  const [status, setStatus] = useState<JourneyKindGuardStatus>("checking");
  const redirectedFor = useRef<string | null>(null);

  const boundRef =
    bookingBoundRef(explicitRef) ?? bookingBoundRef(confirmedBookingRef);

  useEffect(() => {
    let cancelled = false;

    const redirect = (kind: JourneyBookingKind, ref: string) => {
      if (kind === "single_day") setTripMode("single_day");
      if (kind === "multi_day") setTripMode("multi_day");
      if (redirectedFor.current === ref) return;
      redirectedFor.current = ref;
      setStatus("redirecting");
      router.replace(
        opts?.redirectHref?.(ref, kind) ??
          journeyBuilderHref(ref, { type: kind })
      );
    };

    void (async () => {
      // Persisted confirmed ref may arrive a tick after first paint.
      await Promise.resolve(
        useBuilderStore.persist.rehydrate()
      ).catch(() => undefined);
      if (cancelled) return;
      const liveBound =
        bookingBoundRef(explicitRef) ??
        bookingBoundRef(useBuilderStore.getState().confirmedBookingRef);

      if (!liveBound) {
        // Fresh / temp-draft trip: the opened builder is the chosen mode.
        setTripMode(expected);
        setStatus("ok");
        return;
      }

      const local = localKindForRef(liveBound);
      if (local && local.kind !== expected) {
        redirect(local.kind, liveBound);
        return;
      }
      if (local && local.source !== "store") {
        // Brief / saved-lead on this device already identifies the booking.
        setTripMode(expected);
        setStatus("ok");
        return;
      }

      // Store-only (possibly flipped by the old multi-day mount) or no
      // local signal: verify against bookings_and_leads before painting
      // the wrong builder menu.
      setStatus("checking");
      const remote = await fetchJourneyKindForRef(liveBound);
      if (cancelled) return;
      const kind = remote ?? local?.kind ?? null;
      if (kind && kind !== expected) {
        redirect(kind, liveBound);
        return;
      }
      if (kind) setTripMode(expected);
      setStatus("ok");
    })();

    return () => {
      cancelled = true;
    };
  }, [boundRef, explicitRef, expected, router, setTripMode]);

  // Internal status starts at "checking" until hydration rules out a
  // bound confirmed ref hiding in the persisted store.
  return { status, boundRef };
}
