"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  calculateSingleDayQuote,
  formatEur,
  formatYen,
} from "@/lib/singleDayPricing";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";

/**
 * Compact budget breakdown for Builder S sticky bar.
 */
export function SingleDayBudgetModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useModalDismiss(open, onClose);

  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

  const quote = useMemo(
    () =>
      calculateSingleDayQuote({
        guidePreference,
        tourHours,
        experiencePrices: selectedExperiences.map((e) => Number(e.price) || 0),
        conciergeActive,
      }),
    [guidePreference, tourHours, selectedExperiences, conciergeActive]
  );

  if (typeof document === "undefined") return null;

  const guests = adults + children;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sd-budget"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#05080C]/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Target budget breakdown"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-[#0D1117]/95 p-5 shadow-2xl sm:rounded-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1BA58A]">
              Target budget
            </p>
            <h3 className="mt-1 font-godiva text-2xl uppercase tracking-wider text-white">
              Price composition
            </h3>
            <p className="mt-2 text-sm text-white/55">
              Estimate for {guests} guest{guests === 1 ? "" : "s"} · {tourHours}h
              private day. Inclusions update as you add experiences.
            </p>

            <ul className="mt-5 space-y-2.5 text-sm">
              {quote.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-3 border-b border-white/10 pb-2.5"
                >
                  <span className="text-white/75">{line.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-white">
                    {formatEur(line.amountEur)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-2xl border border-[#075473]/50 bg-[#075473]/15 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#00B4D8]">
                Estimated package
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {formatEur(quote.totalEur)}
              </p>
              <p className="mt-0.5 text-sm text-white/55 tabular-nums">
                ≈ {formatYen(quote.totalYen)}
              </p>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-white/45">
              Guide hours, selected experiences, and optional concierge are
              included above. Final confirmation may adjust tickets and seasonal
              surcharges.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

/** Hook-friendly state helper for itinerary page. */
export function useBudgetModalState() {
  const [open, setOpen] = useState(false);
  return { open, openBudget: () => setOpen(true), closeBudget: () => setOpen(false) };
}
