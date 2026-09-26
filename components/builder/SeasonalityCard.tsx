"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";
import { particleSeasonFromDate } from "@/lib/seasonality";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";

type SeasonalityCardProps = {
  arrivalDate: string | null;
  tier: string | null;
  crowds?: string | null;
  note?: string | null;
  onOpenExplain?: () => void;
};

function SeasonLeafIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-[#075473]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3c1.2 2.4 2.8 3.6 5 3.6-1.8 1-2.8 2.6-3 4.8 2.2-.4 4-.2 5.6 1.2-2.2.8-3.6 2.2-4.2 4.4 1.6 0 3 .6 4.2 1.8-2.4.2-4.2 1.2-5.4 3.2-.4-2.2-1.4-3.8-3.2-4.8-1.8 1-2.8 2.6-3.2 4.8C6.6 21 4.8 20 2.4 19.8c1.2-1.2 2.6-1.8 4.2-1.8-.6-2.2-2-3.6-4.2-4.4 1.6-1.4 3.4-1.6 5.6-1.2-.2-2.2-1.2-3.8-3-4.8 2.2 0 3.8-1.2 5-3.6z" />
    </svg>
  );
}

/**
 * Seasonality insight card — triggers ambient particles when tapped
 * (and when a seasonal arrival date is already set).
 */
export function SeasonalityCard({
  arrivalDate,
  tier,
  crowds,
  note,
  onOpenExplain,
}: SeasonalityCardProps) {
  const triggerFromDate = useSeasonalFxStore((s) => s.triggerFromDate);
  const hasInsight = Boolean(tier && note);

  return (
    <button
      type="button"
      onClick={() => {
        if (arrivalDate) triggerFromDate(arrivalDate);
        if (hasInsight) onOpenExplain?.();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        if (arrivalDate) triggerFromDate(arrivalDate);
        if (hasInsight) onOpenExplain?.();
      }}
      disabled={!hasInsight && !particleSeasonFromDate(arrivalDate)}
      className={`relative flex min-h-[44px] flex-col justify-center overflow-hidden rounded-xl border border-[#075473]/40 bg-zinc-900/80 p-3 text-left backdrop-blur-sm transition-all ${
        hasInsight || particleSeasonFromDate(arrivalDate)
          ? "cursor-pointer hover:bg-zinc-800/90"
          : "cursor-default opacity-80"
      }`}
    >
      <BoxGradingGlow />
      <div className="relative z-10">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        Seasonality
      </p>
      <AnimatePresence mode="wait">
        {hasInsight ? (
          <motion.div
            key={`${tier}-${note?.slice(0, 24)}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-white">
              <SeasonLeafIcon />
              <span>{tier} Season</span>
            </p>
            {crowds ? (
              <p className="mt-0.5 text-xs text-zinc-400">{crowds}</p>
            ) : null}
            {note ? (
              <p className="mt-2 hidden text-xs leading-relaxed text-zinc-500 md:block">
                {note}
              </p>
            ) : null}
            <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#075473]">
              <Info className="h-3 w-3 shrink-0" aria-hidden />
              Tap to learn more
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="empty-season"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 text-xs text-zinc-500"
          >
            Select a date for insights
          </motion.p>
        )}
      </AnimatePresence>
      </div>
    </button>
  );
}
