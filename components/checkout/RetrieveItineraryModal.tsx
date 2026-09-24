"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket, X } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  bookingStatusFromPbRecord,
  normalizeBookingPNR,
  type BookingStatus,
} from "@/utils/pnr";

/**
 * Reload a saved itinerary into the builder using email + booking PNR.
 */
export function RetrieveItineraryModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bookingRef: string) => void;
}) {
  const router = useRouter();
  const loadSavedItinerary = useBuilderStore((s) => s.loadSavedItinerary);
  const [email, setEmail] = useState("");
  const [pnr, setPnr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/itinerary/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          pnr: normalizeBookingPNR(pnr),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Local cache fallback (dual-write from Builder save)
        const { LOCAL_LEADS_STORAGE_KEYS } = await import(
          "@/lib/syncBookingLead"
        );
        const cleanPnr = normalizeBookingPNR(pnr);
        const cleanEmail = email.trim().toLowerCase();
        let matched: Record<string, unknown> | null = null;
        for (const key of LOCAL_LEADS_STORAGE_KEYS) {
          try {
            const list = JSON.parse(
              localStorage.getItem(key) || "[]"
            ) as unknown[];
            if (!Array.isArray(list)) continue;
            matched =
              (list.find((item) => {
                if (!item || typeof item !== "object") return false;
                const r = item as Record<string, unknown>;
                return (
                  String(r.booking_ref || "")
                    .trim()
                    .toUpperCase() === cleanPnr &&
                  String(r.email || "")
                    .trim()
                    .toLowerCase() === cleanEmail
                );
              }) as Record<string, unknown> | undefined) || null;
            if (matched) break;
          } catch {
            /* ignore */
          }
        }
        if (!matched) {
          throw new Error(data?.error || "Could not find that itinerary.");
        }
        const {
          expandMultiDaySelectionsToState,
          expandSingleDaySelectionsToState,
        } = await import("@/lib/bookingsAndLeads");
        const lead = {
          id: `local-${cleanPnr}`,
          booking_ref: cleanPnr,
          email: cleanEmail,
          type: (matched.type === "single_day"
            ? "single_day"
            : "multi_day") as "single_day" | "multi_day",
          status: "lead" as const,
          primary_city: String(matched.primary_city || ""),
          tour_date: matched.tour_date ? String(matched.tour_date) : undefined,
          guests: (matched.guests as { adults: number; kids: number }) || {
            adults: 2,
            kids: 0,
          },
          duration_value:
            typeof matched.duration_value === "number"
              ? matched.duration_value
              : undefined,
          selections: (matched.selections || {}) as never,
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
          loadSavedItinerary({
            tripMode: "single_day",
            ...singleDay,
            confirmedBookingRef: cleanPnr,
            bookingStatus: bookingStatusFromPbRecord(String(matched.status)),
          });
        } else {
          loadSavedItinerary({
            ...expandMultiDaySelectionsToState(lead),
            confirmedBookingRef: cleanPnr,
            bookingStatus: bookingStatusFromPbRecord(String(matched.status)),
          });
        }
        onSuccess?.(cleanPnr);
        onClose();
        router.push("/builder/itinerary?view=dossier");
        return;
      }
      const st = (data.state || {}) as Record<string, unknown>;
      const payloadStatus = st.bookingStatus as BookingStatus | undefined;
      loadSavedItinerary({
        ...st,
        confirmedBookingRef: data.bookingRef,
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
      onSuccess?.(data.bookingRef);
      onClose();
      router.push("/builder/itinerary?view=dossier");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrieve failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="retrieve-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
              Retrieve itinerary
            </p>
            <h2
              id="retrieve-title"
              className="mt-1 font-display text-2xl text-[#0B1F3A]"
            >
              Email + Booking PNR
            </h2>
            <p className="mt-1 text-sm text-[#5C6570]">
              Enter the email and PNR from your confirmation to reload and edit
              your trip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8A8278] hover:bg-[#F5F0E8]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Email *
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#075473]"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Booking PNR *
            </span>
            <input
              type="text"
              required
              value={pnr}
              onChange={(e) => setPnr(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 font-mono text-sm tracking-wider text-[#0B1F3A] outline-none focus:border-[#075473]"
              placeholder="JPN-7K9P2X"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up…
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4" />
                Load itinerary
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
