"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { PbSiteBranding } from "@/lib/pocketbase/client";
import {
  brandingSlotSrcSet,
  brandingSlotWebUrl,
  builderHeroSlot,
} from "@/lib/brandingImageSlots";

const HERO_SUBTITLE_DEFAULT =
  "Full Bespoke Vacation across Tokyo, Kyoto & Beyond";

const HERO_CHARACTER_SRC = "/images/peek-character.webp";

// The ONE Multi-Day hero slot — same ID in Site Branding and in
// Layout & Characters → Heroes. No media_version stamp source exists
// for this hero (site_branding has no such field), so the bare slot
// URL is used; replaces overwrite the same file in place.

/**
 * Multi-day builder hero — admin still (or public brand fallback) + character + copy.
 * Empty media → plain grey (never logo stub filler).
 */
export function BuilderHero({
  branding,
  onStartBuilding,
}: {
  branding: PbSiteBranding | null;
  onStartBuilding?: () => void;
}) {
  const [subtitle, setSubtitle] = useState(
    () =>
      branding?.hero_subtitle?.trim() ||
      HERO_SUBTITLE_DEFAULT
  );
  const [heroOk, setHeroOk] = useState(true);
  const heroSrc = brandingSlotWebUrl(builderHeroSlot("multiday"));

  useEffect(() => {
    setSubtitle(
      branding?.hero_subtitle?.trim() || HERO_SUBTITLE_DEFAULT
    );
  }, [branding]);

  return (
    <section
      className="builder-hero relative z-10 flex h-[calc(100dvh-3.75rem)] w-full flex-col overflow-hidden bg-[#05080C] pb-24 lg:h-[100dvh]"
      aria-label="Hero"
    >
      {heroOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroSrc}
          srcSet={brandingSlotSrcSet(builderHeroSlot("multiday"))}
          sizes="100vw"
          alt=""
          onError={() => setHeroOk(false)}
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 z-0 bg-[#2C2C2E]" />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05080C] via-[#05080C]/55 to-[#05080C]/25"
      />

      <Image
        src={HERO_CHARACTER_SRC}
        alt="Tokiotours Grand Japan Journey mascot"
        width={280}
        height={300}
        priority
        sizes="(max-width: 640px) 180px, 280px"
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-[230px] w-auto select-none object-contain object-left-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[300px]"
      />

      <div className="absolute top-1/2 left-4 z-30 flex max-w-[85%] -translate-y-1/2 flex-col items-start text-left sm:left-12 sm:max-w-md">
        <h1 className="flex flex-col items-start text-left leading-tight">
          <span className="relative z-10 -mb-6 translate-y-1 font-beauty text-[3.3rem] font-normal leading-none text-[#E11D48] drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:-mb-9 sm:translate-y-1.5 sm:text-[5.28rem]">
            Grand
          </span>
          <span className="font-hanson text-[1.95rem] font-black tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-[2.925rem]">
            Japan
          </span>
          <span className="-mt-3 font-hanson text-2xl font-black leading-none tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:-mt-3.5 sm:text-4xl">
            Journey
          </span>
        </h1>
        <p className="-mt-1 max-w-[16rem] font-futura text-xs font-medium leading-snug text-zinc-300 opacity-90 sm:max-w-sm sm:text-sm">
          {subtitle || HERO_SUBTITLE_DEFAULT}
        </p>
      </div>

      {onStartBuilding ? (
        // In-flow at the end of the flex column (mt-auto) + section pb-24,
        // so the cue always sits above the mobile bottom nav / fold,
        // whatever the screen height.
        <div className="relative z-30 mt-auto flex justify-center">
          <button
            type="button"
            onClick={onStartBuilding}
            aria-label="Start building your journey"
            className="flex flex-col items-center gap-3 text-zinc-300 transition-colors hover:text-white"
          >
            <span className="text-sm font-bold tracking-[0.25em] uppercase">
              Start Building
            </span>
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border border-white/45 animate-hero-start-cta-ring"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border border-white/25 animate-hero-start-cta-ring [animation-delay:1s]"
              />
              <span className="absolute inset-0 animate-bounce">
                <span className="flex h-full w-full items-center justify-center rounded-full border border-white/30 bg-black/40 animate-widget-call-glow">
                  <ChevronDown className="h-6 w-6" />
                </span>
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
