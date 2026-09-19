"use client";

import { useEffect } from "react";
import { Play, Sparkles, Target } from "lucide-react";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { TravelProfileBadge } from "@/components/quiz/TravelProfileBadge";

/**
 * Dual CTA banner for Tailored Experiences / Discover:
 * Match Reel + Style Quiz — copy & media from Site Branding.
 */
export function ActivityMatcherBanner({
  onOpenQuiz,
  onWatch,
}: {
  onOpenQuiz: () => void;
  /** Opens Activity Match Reel */
  onWatch?: () => void;
}) {
  const profile = useBuilderStore((s) => s.experienceProfile);
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const banner = useSiteBrandingStore((s) => s.getActivityMatcherBanner)();
  void brandingItems;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const eyebrow = banner.title || "Activity Matcher";
  const headline = profile
    ? "Matches stay active across Builder & Discover"
    : banner.subtitle;
  const primaryCta = banner.ctaPrimary || "Watch Your Activity Match Reel";
  const secondaryCta = profile
    ? "Edit Style Quiz"
    : banner.ctaSecondary || "Take 30-Sec Style Quiz";
  const imageSrc = banner.mediaUrl || "/images/matcher-poster.webp";

  return (
    <div className="space-y-2.5">
      {profile ? <TravelProfileBadge onRetake={onOpenQuiz} tone="dark" /> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
        <div className="relative aspect-[21/9] min-h-[7rem] w-full sm:aspect-[2.4/1]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
          <div className="absolute inset-0 flex flex-col justify-center gap-3 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#B85304] sm:text-[10px]">
                {eyebrow}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white sm:text-base">
                {headline}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onWatch ?? onOpenQuiz}
                className="flex items-center gap-1.5 rounded-xl border border-[#B85304]/40 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-semibold text-accent-500 shadow-lg transition-all hover:border-accent-500/40 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
              >
                <Play className="h-3.5 w-3.5 fill-accent-400 sm:h-4 sm:w-4" aria-hidden />
                <span>{primaryCta}</span>
              </button>
              <button
                type="button"
                onClick={onOpenQuiz}
                className="inline-flex items-center gap-1 rounded-full border border-[#B85304]/50 bg-[#B85304]/15 px-2.5 py-1 text-[10px] font-semibold text-[#F3D9C4] transition hover:bg-[#B85304]/25 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px]"
              >
                {profile ? (
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
                ) : (
                  <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
                )}
                {secondaryCta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
