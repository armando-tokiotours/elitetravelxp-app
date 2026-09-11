"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_HERO_IMAGE,
  DEFAULT_SITE_BRANDING,
  brandingHeroUrl,
  fetchPublicBrandAssets,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

const HERO_SUBTITLE_DEFAULT =
  "Design every detail we'll take care of the rest";

export function BuilderHero({ branding }: { branding: PbSiteBranding | null }) {
  const [heroUrl, setHeroUrl] = useState(
    () => brandingHeroUrl(branding) || DEFAULT_HERO_IMAGE
  );
  const subtitle =
    branding?.hero_subtitle?.trim() ||
    DEFAULT_SITE_BRANDING.hero_subtitle ||
    HERO_SUBTITLE_DEFAULT;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const publicAssets = await fetchPublicBrandAssets();
      if (cancelled) return;
      setHeroUrl(brandingHeroUrl(branding, publicAssets) || DEFAULT_HERO_IMAGE);
    })();
    return () => {
      cancelled = true;
    };
  }, [branding]);

  return (
    <section
      className="builder-hero relative h-[50vh] max-h-[480px] w-full min-h-[260px] md:h-[60vh] md:max-h-none md:min-h-[420px]"
      aria-label="Hero"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div
          className="builder-hero-bg absolute inset-0 bg-[#F5F0E8] bg-cover bg-[position:60%_center] bg-no-repeat md:bg-center"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />
        {/* Soft wash — keep sky readable without hiding the landscape */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F5F0E8]/85 to-transparent sm:h-28" />
      </div>

      {/* Vertically centered, left-aligned text stack */}
      <div className="absolute inset-0 z-10 flex items-center justify-start px-5 pb-14 pt-16 sm:px-8 sm:pb-16 sm:pt-20 md:px-12">
        <div className="flex max-w-[min(100%,28rem)] flex-col items-start text-left md:max-w-2xl">
          <h1 className="builder-hero-title flex flex-col items-start uppercase leading-none">
            <span className="text-[#0B132B]">BUILD</span>
            <span className="text-[0.8em] text-[#0B132B]">YOUR PERFECT</span>
            <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
              JAPAN TRIP
            </span>
          </h1>

          <div className="mt-4 bg-[#C5A059] px-4 py-1.5 shadow-sm">
            <p className="font-medium text-sm text-[#0B132B] md:text-base">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
