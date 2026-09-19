"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";

export function RefundPolicyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
          key="refund-policy"
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-policy-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] max-h-[min(90dvh,36rem)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B85304]">
              Elite Concierge
            </p>
            <h2
              id="refund-policy-title"
              className="mb-2 mt-1 text-lg font-bold text-white"
            >
              Elite Concierge Terms & Refund Policy
            </h2>

            <ul className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
              <li>
                <p className="font-semibold text-accent-500">
                  €{ELITE_CONCIERGE_FEE} Tour Credit
                </p>
                <p className="mt-1 text-zinc-400">
                  The €{ELITE_CONCIERGE_FEE} design fee acts as a commitment
                  deposit and will be fully credited against your total
                  itinerary invoice upon payment.
                </p>
              </li>
              <li>
                <p className="font-semibold text-accent-500">
                  Concierge Guarantee
                </p>
                <p className="mt-1 text-zinc-400">
                  If our team cannot fulfill your requested dates or
                  hard-to-get reservations during the initial consultation, the
                  €{ELITE_CONCIERGE_FEE} fee is 100% refundable within 7 days.
                </p>
              </li>
              <li>
                <p className="font-semibold text-accent-500">Cancellation</p>
                <p className="mt-1 text-zinc-400">
                  If you decide to cancel your trip design before booking, the
                  €{ELITE_CONCIERGE_FEE} covers the custom day-by-day research
                  work and is non-refundable.
                </p>
              </li>
            </ul>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#143052]"
            >
              I Understand
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
