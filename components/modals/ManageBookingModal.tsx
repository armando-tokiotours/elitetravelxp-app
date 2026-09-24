"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import {
  bookingStatusFromPbRecord,
  normalizeBookingPNR,
  type BookingStatus,
} from "@/utils/pnr";
import { LOCAL_LEADS_STORAGE_KEYS } from "@/lib/syncBookingLead";
import type { BookingLeadType } from "@/lib/bookingsAndLeads";
import {
  emptyTiming,
  parseItineraryData,
  type PreEliteBookingPayload,
} from "@/lib/preEliteBuilder";

export interface ManageBookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (bookingRef: string) => void;
  initialPnr?: string;
  initialEmail?: string;
  /** Default `/pre-build`. Pass `null` to skip auto-navigation. */
  successHref?: string | null;
}

const ERROR_MSG =
  "No itinerary found for that email and booking PNR. Check both and try again.";

type LocalLead = {
  booking_ref?: string;
  email?: string;
  type?: BookingLeadType | string;
  status?: string;
  selections?: Record<string, unknown>;
  primary_city?: string;
  tour_date?: string;
  guests?: { adults?: number; kids?: number };
  duration_value?: number;
};

function findLocalLead(cleanPnr: string, cleanEmail: string): LocalLead | null {
  if (typeof window === "undefined") return null;
  for (const key of LOCAL_LEADS_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed) ? parsed : [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as LocalLead;
        const ref = String(row.booking_ref || "")
          .trim()
          .toUpperCase();
        const mail = String(row.email || "")
          .trim()
          .toLowerCase();
        if (ref === cleanPnr && mail === cleanEmail) return row;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function restorePreBuilderFromBrief(opts: {
  bookingRef: string;
  fullName: string;
  email: string;
  itineraryData: string;
}) {
  const parsed = parseItineraryData(opts.itineraryData);
  const payload: PreEliteBookingPayload = {
    bookingRef: opts.bookingRef,
    fullName: opts.fullName || "Guest",
    email: opts.email,
    status: "draft",
    itineraryData: opts.itineraryData,
  };

  usePreBuilderStore.setState({
    ...(parsed
      ? {
          travelStyle: parsed.travelStyle,
          interests: parsed.interests,
          tripMotivation: parsed.tripMotivation,
          painPoints: parsed.painPoints,
          tripType: parsed.tripType,
          timing: parsed.timing || emptyTiming(),
          adults: parsed.groupSize.adults,
          children: parsed.groupSize.children,
          whatsapp: parsed.whatsapp || "",
        }
      : {}),
    fullName: opts.fullName,
    email: opts.email,
    bookingRef: opts.bookingRef,
    submittedAt: new Date().toISOString(),
    lastPayload: payload,
    step: 5,
  });
}

async function hydrateFromLead(opts: {
  bookingRef: string;
  email?: string;
  type: string;
  status?: string;
  selections?: Record<string, unknown>;
  primary_city?: string;
  tour_date?: string;
  guests?: { adults?: number; kids?: number };
  duration_value?: number;
  loadSavedItinerary: (patch: Record<string, unknown>) => void;
}) {
  const {
    expandMultiDaySelectionsToState,
    expandSingleDaySelectionsToState,
  } = await import("@/lib/bookingsAndLeads");

  const lead = {
    id: `local-${opts.bookingRef}`,
    booking_ref: opts.bookingRef,
    email: opts.email || "",
    type: (opts.type === "single_day" ? "single_day" : "multi_day") as BookingLeadType,
    status: (opts.status as "lead") || "lead",
    primary_city: opts.primary_city,
    tour_date: opts.tour_date,
    guests: {
      adults: opts.guests?.adults ?? 2,
      kids: opts.guests?.kids ?? 0,
    },
    duration_value: opts.duration_value,
    selections: (opts.selections || {}) as never,
  };

  if (lead.type === "single_day") {
    const singleDay = expandSingleDaySelectionsToState(lead);
    const { useSingleDayBuilderStore } = await import(
      "@/store/useSingleDayBuilderStore"
    );
    useSingleDayBuilderStore.setState({
      ...useSingleDayBuilderStore.getState(),
      ...singleDay,
    });
    opts.loadSavedItinerary({
      tripMode: "single_day",
      ...singleDay,
      confirmedBookingRef: opts.bookingRef,
      bookingStatus: bookingStatusFromPbRecord(opts.status),
    });
  } else {
    const state = expandMultiDaySelectionsToState(lead);
    opts.loadSavedItinerary({
      ...state,
      confirmedBookingRef: opts.bookingRef,
      bookingStatus: bookingStatusFromPbRecord(
        opts.status,
        (state as { bookingStatus?: BookingStatus }).bookingStatus
      ),
    });
  }

  const embedded =
    typeof opts.selections?.preEliteBrief === "string"
      ? opts.selections.preEliteBrief
      : typeof opts.selections?.itineraryData === "string"
        ? opts.selections.itineraryData
        : "";
  if (embedded) {
    const fullName =
      typeof opts.selections?.fullName === "string"
        ? opts.selections.fullName
        : typeof opts.selections?.full_name === "string"
          ? opts.selections.full_name
          : "";
    restorePreBuilderFromBrief({
      bookingRef: opts.bookingRef,
      fullName,
      email: opts.email || "",
      itineraryData: embedded,
    });
  }
}

export function ManageBookingModal({
  open,
  onClose,
  onSuccess,
  initialPnr = "",
  initialEmail = "",
  successHref = "/pre-build",
}: ManageBookingModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pnr, setPnr] = useState(initialPnr);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSavedItinerary = useBuilderStore((s) => s.loadSavedItinerary);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPnr(normalizeBookingPNR(initialPnr));
    setEmail(initialEmail.trim().toLowerCase());
    setBusy(false);
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initialPnr, initialEmail]);

  const finishSuccess = (ref: string) => {
    onSuccess?.(ref);
    onClose();
    if (successHref) router.push(successHref);
  };

  async function handleRetrieve(e: FormEvent) {
    e.preventDefault();
    const cleanPnr = normalizeBookingPNR(pnr);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanPnr || !cleanEmail) {
      setError(ERROR_MSG);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(ERROR_MSG);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/itinerary/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          pnr: cleanPnr,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        bookingRef?: string;
        state?: Record<string, unknown>;
        status?: string;
        error?: string;
        singleDay?: Record<string, unknown> | null;
        preElite?: {
          bookingRef?: string;
          fullName?: string;
          email?: string;
          itineraryData?: string;
          status?: string;
        } | null;
      };

      if (res.ok && data.ok && data.state) {
        const payloadStatus = data.state.bookingStatus as
          | BookingStatus
          | undefined;
        const lockedRef = data.bookingRef || cleanPnr;
        loadSavedItinerary({
          ...data.state,
          confirmedBookingRef: lockedRef,
          bookingStatus: bookingStatusFromPbRecord(
            data.status,
            payloadStatus
          ),
        });

        if (data.singleDay && typeof data.singleDay === "object") {
          const { useSingleDayBuilderStore } = await import(
            "@/store/useSingleDayBuilderStore"
          );
          useSingleDayBuilderStore.setState({
            ...useSingleDayBuilderStore.getState(),
            ...data.singleDay,
          });
        }

        if (data.preElite?.itineraryData) {
          restorePreBuilderFromBrief({
            bookingRef: data.preElite.bookingRef || lockedRef,
            fullName: data.preElite.fullName || "",
            email: data.preElite.email || cleanEmail,
            itineraryData: data.preElite.itineraryData,
          });
        }

        finishSuccess(lockedRef);
        return;
      }

      const match = findLocalLead(cleanPnr, cleanEmail);
      if (match) {
        await hydrateFromLead({
          bookingRef: cleanPnr,
          email: cleanEmail,
          type: String(match.type || "multi_day"),
          status: match.status,
          selections: match.selections,
          primary_city: match.primary_city,
          tour_date: match.tour_date,
          guests: match.guests,
          duration_value: match.duration_value,
          loadSavedItinerary,
        });
        finishSuccess(cleanPnr);
        return;
      }

      setError(data.error || ERROR_MSG);
    } catch {
      const match = findLocalLead(cleanPnr, cleanEmail);
      if (match) {
        try {
          await hydrateFromLead({
            bookingRef: cleanPnr,
            email: cleanEmail,
            type: String(match.type || "multi_day"),
            status: match.status,
            selections: match.selections,
            primary_city: match.primary_city,
            tour_date: match.tour_date,
            guests: match.guests,
            duration_value: match.duration_value,
            loadSavedItinerary,
          });
          finishSuccess(cleanPnr);
          return;
        } catch {
          /* fall through */
        }
      }
      setError(ERROR_MSG);
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="tokio-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className="tokio-modal-content relative z-[1] w-full max-w-md rounded-2xl border border-white/10 p-6 text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-booking-title"
      >
        <h2
          id="manage-booking-title"
          className="mb-1 text-xl font-bold text-white"
        >
          Manage My Booking
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Enter your details to reopen your Pre-Build brief and itinerary.
        </p>

        <form onSubmit={handleRetrieve}>
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            placeholder="Booking Reference (e.g. JPN-7K9P2X)"
            autoComplete="off"
            spellCheck={false}
            className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm uppercase tracking-wider text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-zinc-600"
            disabled={busy}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            autoComplete="email"
            className="mb-6 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-600"
            disabled={busy}
          />

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-900/70 bg-red-950/50 px-3 py-2.5 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent-500 py-3 font-bold text-white transition-all hover:bg-[#05384c] disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? "Retrieving…" : "Retrieve Itinerary"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
