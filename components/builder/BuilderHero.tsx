"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_HERO_IMAGE,
  brandingHeroUrl,
  fetchPublicBrandAssets,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

const HERO_SUBTITLE_DEFAULT =
  "Design every detail we'll take care of the rest";

const HERO_CHARACTER_SRC = "/images/peek-character.png";

/**
 * Multi-day builder hero — admin still (or public brand fallback) + character + copy.
 * Video/scrim removed so first paint stays instant; image is the Team Branding upload.
 */
export function BuilderHero({ branding }: { branding: PbSiteBranding | null }) {
  const [subtitle, setSubtitle] = useState(
    () =>
      branding?.hero_subtitle?.trim() ||
      HERO_SUBTITLE_DEFAULT
  );
  const [heroSrc, setHeroSrc] = useState(DEFAULT_HERO_IMAGE);

  useEffect(() => {
    setSubtitle(
      branding?.hero_subtitle?.trim() || HERO_SUBTITLE_DEFAULT
    );
  }, [branding]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBrandAssets().then((assets) => {
      if (cancelled) return;
      setHeroSrc(brandingHeroUrl(branding, assets));
    });
    return () => {
      cancelled = true;
    };
  }, [branding]);

  return (
    <section
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#05080C] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Hero"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroSrc}
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05080C] via-[#05080C]/55 to-[#05080C]/25"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_CHARACTER_SRC}
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-[230px] w-auto select-none object-contain object-left-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[300px]"
      />

      <div className="absolute top-1/2 left-4 z-30 flex max-w-[85%] -translate-y-1/2 flex-col items-start text-left sm:left-12 sm:max-w-md">
        <h1 className="flex flex-col items-start text-left leading-tight">
          <span className="relative z-10 -mb-6 translate-y-1 font-beauty text-[3.3rem] font-normal leading-none text-[#E11D48] drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:-mb-9 sm:translate-y-1.5 sm:text-[5.28rem]">
            Japan!
          </span>
          <span className="font-hanson text-[1.95rem] font-black tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-[2.925rem]">
            TRIP
          </span>
          <span className="-mt-3 font-hanson text-2xl font-black leading-none tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:-mt-3.5 sm:text-4xl">
            BUILDER
          </span>
        </h1>
        <p className="-mt-1 max-w-[16rem] font-futura text-xs font-medium leading-snug text-zinc-300 opacity-90 sm:max-w-sm sm:text-sm">
          {subtitle || HERO_SUBTITLE_DEFAULT}
        </p>
      </div>
    </section>
  );
}
