"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  bookingStatusFromPbRecord,
  type BookingStatus,
} from "@/utils/pnr";

export interface ManageBookingModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful retrieve (parent may show a toast). */
  onSuccess?: (bookingRef: string) => void;
}

const ERROR_MSG =
  "No matching booking found. Please check your reference code and email.";

export function ManageBookingModal({
  open,
  onClose,
  onSuccess,
}: ManageBookingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [pnr, setPnr] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSavedItinerary = useBuilderStore((s) => s.loadSavedItinerary);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPnr("");
    setEmail("");
    setBusy(false);
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleRetrieve(e: FormEvent) {
    e.preventDefault();
    const bookingRef = pnr.trim().toUpperCase();
    const emailNorm = email.trim().toLowerCase();
    if (!bookingRef || !emailNorm) {
      setError(ERROR_MSG);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
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
          email: emailNorm,
          pnr: bookingRef,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        bookingRef?: string;
        state?: Record<string, unknown>;
        status?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.state) {
        setError(data.error || ERROR_MSG);
        return;
      }

      const payloadStatus = data.state.bookingStatus as
        | BookingStatus
        | undefined;
      const lockedRef = data.bookingRef || bookingRef;
      loadSavedItinerary({
        ...data.state,
        confirmedBookingRef: lockedRef,
        bookingStatus: bookingStatusFromPbRecord(
          data.status,
          payloadStatus
        ),
      });
      onSuccess?.(data.bookingRef || bookingRef);
      onClose();
    } catch {
      setError(ERROR_MSG);
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-booking-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
        <h2
          id="manage-booking-title"
          className="mb-1 text-xl font-bold text-white"
        >
          Manage My Booking
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Enter your details to view or modify your itinerary.
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
            className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition-all hover:bg-amber-400 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? "Retrieving…" : "Retrieve Itinerary"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
