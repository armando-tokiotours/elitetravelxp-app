"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

/**
 * Destructive confirmation before wiping builder state / booking ref.
 */
export function ResetBookingModal({
  open,
  bookingRef,
  onClose,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  bookingRef: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  if (!open || typeof document === "undefined") return null;

  const refLabel = bookingRef || "your draft reference";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center tokio-modal-backdrop bg-[#05080C]/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-booking-title"
      onClick={() => (!busy ? onClose() : undefined)}
    >
      <div
        className="tokio-modal-content relative w-full max-w-sm rounded-2xl border border-red-500/40 p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle
          className="mx-auto mb-2 block h-8 w-8 text-red-400"
          aria-hidden
        />
        <h2
          id="reset-booking-title"
          className="text-lg font-extrabold text-white"
        >
          Start a New Booking?
        </h2>
        <p className="mb-5 mt-1 text-xs text-zinc-400">
          We&apos;ll erase this itinerary, create a fresh booking reference, and
          email you a Manage Booking link for the new PNR (when your email is on
          file). Current ref: ({refLabel}). This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#1C1C1E] py-2.5 px-4 text-xs font-bold text-zinc-300 transition hover:bg-[#2C2C2E] disabled:opacity-50"
          >
            Keep Current
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Resetting…" : "Yes, Reset All"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
