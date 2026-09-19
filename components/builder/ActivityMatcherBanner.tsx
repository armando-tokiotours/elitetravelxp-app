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
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                {eyebrow}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-white sm:text-base">
                {headline}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onWatch ?? onOpenQuiz}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-amber-300 shadow-lg transition-all hover:border-amber-400"
              >
                <Play className="h-4 w-4 fill-amber-400" aria-hidden />
                <span>{primaryCta}</span>
              </button>
              <button
                type="button"
                onClick={onOpenQuiz}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#C4A35A]/50 bg-[#C4A35A]/15 px-3 py-1.5 text-[11px] font-semibold text-[#E8D5A3] transition hover:bg-[#C4A35A]/25"
              >
                {profile ? (
                  <Sparkles className="h-3 w-3" aria-hidden />
                ) : (
                  <Target className="h-3 w-3" aria-hidden />
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
