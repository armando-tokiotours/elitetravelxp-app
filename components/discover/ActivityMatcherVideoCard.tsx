"use client";

import { Play, Target } from "lucide-react";

/**
 * Discover-only matcher CTA — sits below the tour/experience photo grid.
 */
export function ActivityMatcherVideoCard({
  onOpenQuiz,
  onWatch,
}: {
  onOpenQuiz: () => void;
  onWatch?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
      <div className="relative aspect-[21/9] min-h-[8rem] w-full sm:aspect-[2.4/1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/matcher-poster.webp"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/35" />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
              Activity Matcher
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-white sm:text-[15px]">
              Unsure which tour fits your pace? Watch how we curate experiences
              based on your travel profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onWatch ?? onOpenQuiz}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-amber-300 shadow-lg transition-all hover:border-amber-400"
            >
              <Play className="h-4 w-4 fill-amber-400" aria-hidden />
              <span>Watch Your Activity Match Reel</span>
            </button>
            <button
              type="button"
              onClick={onOpenQuiz}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#C4A35A]/50 bg-[#C4A35A]/15 px-3 py-1.5 text-[11px] font-semibold text-[#E8D5A3] transition hover:bg-[#C4A35A]/25"
            >
              <Target className="h-3 w-3" aria-hidden />
              Edit Style Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
