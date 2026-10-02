"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

/**
 * Destructive confirmation before wiping builder state / booking ref.
 * Optionally asks whether to keep the same guest name + email.
 */
export function ResetBookingModal({
  open,
  bookingRef,
  onClose,
  onConfirm,
  busy = false,
  guestName = "",
  guestEmail = "",
}: {
  open: boolean;
  bookingRef: string;
  onClose: () => void;
  /** keepSameGuest = true preserves name/email on the new PNR */
  onConfirm: (keepSameGuest: boolean) => void;
  busy?: boolean;
  guestName?: string;
  guestEmail?: string;
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
  const hasGuest = Boolean(guestName.trim() || guestEmail.trim());
  const guestLine = [guestName.trim(), guestEmail.trim()]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05080C]/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-booking-title"
      onClick={() => (!busy ? onClose() : undefined)}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-red-500/40 bg-[#0D1117] p-5 text-center shadow-2xl"
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
          Start a New Request?
        </h2>
        <p className="mt-1 mb-3 text-xs text-zinc-400">
          Your current draft ({refLabel}) was{" "}
          <span className="font-semibold text-amber-300">not saved</span> and
          will be deleted. This cannot be undone.
        </p>

        {hasGuest ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-left">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Same guest?
            </p>
            <p className="mt-0.5 truncate text-sm text-white">{guestLine}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Keep this name &amp; email on the new booking, or start with a
              blank guest.
            </p>
          </div>
        ) : (
          <p className="mb-4 text-xs text-zinc-400">
            We&apos;ll mint a fresh booking reference for a new request.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {hasGuest ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(true)}
                className="w-full rounded-xl bg-red-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Resetting…" : "Yes — same name & email"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(false)}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 px-4 text-xs font-bold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {busy ? "Resetting…" : "No — different guest"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(false)}
              className="w-full rounded-xl bg-red-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Yes, start new"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full rounded-xl bg-[#1C1C1E] py-2.5 px-4 text-xs font-bold text-zinc-300 transition hover:bg-[#2C2C2E] disabled:opacity-50"
          >
            Keep current draft
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
