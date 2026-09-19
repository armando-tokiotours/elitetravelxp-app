"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, X } from "lucide-react";
import { formatUsd } from "@/lib/builder-pricing";

export function DepositCheckoutSheet({
  open,
  onClose,
  onConfirm,
  submitting,
  error,
  quoteMin,
  quoteMax,
  depositMin,
  depositMax,
  totalGuests,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error: string | null;
  quoteMin: number;
  quoteMax: number;
  depositMin: number;
  depositMax: number;
  totalGuests: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Lock quotation with deposit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/50"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[#D9D2C7]" />
            </div>

            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B85304]">
                  Secure your journey
                </p>
                <h3 className="mt-1 font-display text-2xl text-[#0B1F3A]">
                  10% deposit to lock
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8E2D9] text-[#5C6570] transition hover:bg-[#F7F3EB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 pb-2">
              <div className="rounded-2xl border border-[#E8E2D9] bg-[#FBF8F2] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8278]">
                  Experience Japan Range
                </p>
                <p className="mt-1 font-display text-xl text-[#0B1F3A]">
                  Est. {formatUsd(quoteMin)} – {formatUsd(quoteMax)}
                </p>
                <p className="mt-0.5 text-xs text-[#8A8278]">
                  {totalGuests} guest{totalGuests === 1 ? "" : "s"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#B85304]/40 bg-[#FDF7F3] px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#B85304]" aria-hidden />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B85304]">
                    Today&apos;s 10% deposit
                  </p>
                </div>
                <p className="mt-1.5 font-display text-2xl text-[#0B1F3A]">
                  Est. {formatUsd(depositMin)}
                  {depositMax !== depositMin
                    ? ` – ${formatUsd(depositMax)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#632502]">
                  Paying this deposit locks your quotation range. Remaining
                  balance is confirmed once your itinerary is finalized.
                </p>
              </div>

              <p className="rounded-xl bg-[#F7F3EB] px-3.5 py-3 text-xs leading-relaxed text-[#5C6570]">
                A travel expert will arrange the final details — hotels, guides,
                and timing — and confirm your exact quotation before the
                remaining balance is due.
              </p>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                disabled={submitting || quoteMin <= 0}
                onClick={onConfirm}
                className="w-full rounded-full bg-[#0B1F3A] py-3.5 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:opacity-50"
              >
                {submitting
                  ? "Locking quotation…"
                  : "Confirm & lock with 10% deposit"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-full rounded-full border border-[#D9D2C7] bg-white py-3 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#F7F3EB] disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
