"use client";

import { useEffect } from "react";
import { Play, Target } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

/**
 * Discover-only matcher CTA — sits below the tour/experience photo grid.
 * Poster-only (no video) until the user opens Match Reel / Matches panel.
 * Copy & background from Site Branding → activity_matcher_banner.
 */
export function ActivityMatcherVideoCard({
  onOpenQuiz,
  onWatch,
}: {
  onOpenQuiz: () => void;
  onWatch?: () => void;
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const banner = useSiteBrandingStore((s) => s.getActivityMatcherBanner)();
  void brandingItems;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const eyebrow = banner.title || "Activity Matcher";
  const headline =
    banner.subtitle ||
    "Unsure what to pick? Take our 30-Second Activity Matcher";
  const primaryCta = banner.ctaPrimary || "Watch Your Activity Match Reel";
  const secondaryCta = banner.ctaSecondary || "Take 30-Sec Style Quiz";
  const imageSrc = banner.mediaUrl || "/images/matcher-poster.webp";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
      <div className="relative aspect-[21/9] min-h-[8rem] w-full sm:aspect-[2.4/1]">
        <MediaImage
          src={imageSrc}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/35" />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
              {eyebrow}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-white sm:text-[15px]">
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
              <Target className="h-3 w-3" aria-hidden />
              {secondaryCta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
