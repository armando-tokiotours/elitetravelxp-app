"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { SeasonTierName } from "@/store/useBuilderStore";

const SEASON_IMAGES: Record<SeasonTierName, string> = {
  Low: "/photo/season-low.jpg",
  Mid: "/photo/season-mid.jpg",
  High: "/photo/season-high.jpg",
};

/**
 * Shared seasonality insight drawer — used by Builder M and Builder S.
 */
export function SeasonalityDetailModal({
  open,
  onClose,
  tier,
  crowds,
  note,
}: {
  open: boolean;
  onClose: () => void;
  tier: SeasonTierName | null;
  crowds: string;
  note: string;
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

  if (!mounted || !tier) return null;

  const image = SEASON_IMAGES[tier] || SEASON_IMAGES.Mid;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="season-explainer"
          className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${tier} Season`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/55"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                  Seasonality
                </p>
                <h3 className="truncate font-display text-2xl text-[#0B1F3A]">
                  {tier} Season
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
                <div className="relative aspect-[4/5] max-h-[45dvh] w-full bg-[#0B1F3A] sm:max-h-[50dvh]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-4 py-4 sm:px-5">
                  {crowds ? (
                    <p className="text-sm font-semibold text-[#075473]">
                      {crowds}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-[#5C6570]">
                    {note ||
                      "Seasonal conditions for your arrival date will appear here once configured in Team Access."}
                  </p>
                </div>
              </article>
            </div>

            <div className="shrink-0 border-t border-[#EEE8DF] bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-[#D9D2C7] bg-white py-3.5 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#F7F3EB]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
