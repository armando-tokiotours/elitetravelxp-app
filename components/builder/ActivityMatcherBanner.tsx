"use client";

import { useEffect } from "react";
import { Play, Sparkles, Target } from "lucide-react";
import { useActiveMatchProfile } from "@/store/useQuizStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { TravelProfileBadge } from "@/components/quiz/TravelProfileBadge";

/**
 * Dual CTA banner for Tailored Experiences / Discover:
 * Match Reel + Style Quiz — copy & media from Site Branding.
 */
export function ActivityMatcherBanner({
  onOpenQuiz,
  onWatch,
  onDiscover,
  showProfile = true,
}: {
  onOpenQuiz: () => void;
  /** Opens Activity Match Reel */
  onWatch?: () => void;
  /** Navigate to Discover Activities */
  onDiscover?: () => void;
  /** When false, Travel Profile badge is rendered by the parent */
  showProfile?: boolean;
}) {
  const profile = useActiveMatchProfile();
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
      {showProfile && profile ? (
        <TravelProfileBadge onRetake={onOpenQuiz} tone="dark" />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
        <div className="relative aspect-[21/9] min-h-[7.5rem] w-full sm:aspect-[2.4/1] sm:min-h-[8.5rem]">
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
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#D9718C] sm:text-[10px]">
                {eyebrow}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white sm:text-base">
                {headline}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onWatch ?? onOpenQuiz}
                className="flex items-center gap-1.5 rounded-lg border border-[#F6A724]/40 bg-black/60 px-3 py-1.5 text-[11px] font-bold text-[#F6A724] shadow-md backdrop-blur-md transition-all hover:bg-black/80 sm:text-xs"
              >
                <Play
                  className="h-3.5 w-3.5 fill-[#F6A724]"
                  aria-hidden
                />
                <span>{primaryCta}</span>
              </button>
              {onDiscover ? (
                <button
                  type="button"
                  onClick={onDiscover}
                  className="flex items-center gap-1.5 rounded-lg border border-[#F6A724]/60 bg-[#F6A724]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F6A724] shadow-md backdrop-blur-md transition-all hover:bg-[#F6A724]/30 sm:text-[11px]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#F6A724]" aria-hidden />
                  Discover Activities
                </button>
              ) : null}
              <button
                type="button"
                onClick={onOpenQuiz}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 text-[10px] font-medium text-zinc-300 backdrop-blur-md transition hover:bg-black/80 sm:px-3 sm:text-[11px]"
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
