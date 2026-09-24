"use client";

import { useEffect } from "react";

/**
 * How booking & deposits work — shown before Invoice / Print or Send / Save PDF.
 */
export function BookingTermsModal({
  open,
  onConfirm,
  onCancel,
  confirmLabel = "I Understand — Proceed to Invoice / Download PDF →",
  cancelLabel = "Back to Builder",
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center tokio-modal-backdrop bg-[#05080C]/50 p-4 backdrop-blur-md no-print print:hidden"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-terms-title"
        className="w-full max-w-md space-y-4 rounded-3xl border border-[#075473]/40 bg-[#1C1C1E] p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#075473]/40 bg-[#075473]/20 text-xl"
            aria-hidden
          >
            📜
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#E60F43]">
              TOKIOTOURS
            </span>
            <h3
              id="booking-terms-title"
              className="text-base font-black text-white"
            >
              How Your Itinerary & Booking Works
            </h3>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
          <p>
            <strong className="text-[#F6A724]">1. Estimated Quotes:</strong>{" "}
            This builder provides realistic price estimates for your
            personalized Japan route, hotels, tours, and transport choices. You
            can request our team to arrange everything turnkey, or use this
            dossier as your private guide.
          </p>

          <p>
            <strong className="text-[#F6A724]">
              2. Lock Dates & Secure Booking:
            </strong>{" "}
            To confirm exact travel dates and issue your official itinerary
            dossier, a small design deposit fee is required.
          </p>

          <div className="rounded-2xl border border-[#DC6E8A]/30 bg-[#DC6E8A]/10 p-3 text-[11px] font-medium text-[#DC6E8A]">
            💡 <strong>100% Deposit Credit:</strong> Your fee is 100% applied
            as a credit toward your confirmed tour packages and travel
            arrangements. Terms &amp; Conditions apply.
          </div>

          <p className="text-[11px] text-zinc-400">
            *Note: Hotel and chauffeur reservations are officially secured once
            the deposit is received. A dedicated TOKIOTOURS consultant will
            reach out via WhatsApp/Email immediately after payment to review
            every detail.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl bg-[#075473] py-3 text-xs font-bold text-white shadow-lg transition hover:bg-[#a04602]"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-white"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
