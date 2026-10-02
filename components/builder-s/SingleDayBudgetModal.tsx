"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { PandaFlexibleMascot } from "@/components/branding/PandaFlexibleMascot";
import {
  calculateSingleDayQuote,
  formatEur,
  formatYen,
  singleDayPerPersonEur,
  singleDayPerPersonHourEur,
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
  const preferredMovement = useSingleDayBuilderStore((s) => s.preferredMovement);
  const suicaNeeded = useSingleDayBuilderStore((s) => s.suicaNeeded);
  const suicaValueEur = useSingleDayBuilderStore((s) => s.suicaValueEur);
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

  const quote = useMemo(
    () =>
      calculateSingleDayQuote({
        guidePreference,
        tourHours,
        experiencePrices: selectedExperiences.map((e) => Number(e.price) || 0),
        conciergeActive,
        preferredMovement,
        suicaNeeded,
        suicaValueEur,
        guests: Math.max(1, adults + children),
      }),
    [
      guidePreference,
      tourHours,
      selectedExperiences,
      conciergeActive,
      preferredMovement,
      suicaNeeded,
      suicaValueEur,
      adults,
      children,
    ]
  );

  if (typeof document === "undefined") return null;

  const guests = Math.max(1, adults + children);
  const perPerson = singleDayPerPersonEur(quote.totalEur, guests);
  const perPersonHour = singleDayPerPersonHourEur(
    quote.totalEur,
    guests,
    tourHours
  );

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sd-budget"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05080C]/70 p-4 backdrop-blur-sm"
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
            className="relative z-[1] max-h-[min(90vh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0D1117]/95 p-5 shadow-2xl"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F6A724]">
              Target budget for TokioTours
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
                Estimated · per person
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {formatEur(perPerson)}
                <span className="ml-1.5 text-sm font-semibold text-white/50">
                  /pp
                </span>
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-white/55">
                {tourHours}h · {formatEur(perPersonHour)} /pp/h
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
                Party {formatEur(quote.totalEur)} · ≈ {formatYen(quote.totalYen)}
              </p>
            </div>

            <p className="mt-4 text-[11px] font-semibold leading-relaxed text-[#F6A724]">
              ★ 100% FLEXIBLE: Change dates, routes, or stops anytime.
            </p>
            <PandaFlexibleMascot size="sm" className="mt-2" />
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
