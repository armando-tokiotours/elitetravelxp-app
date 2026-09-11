"use client";

import {
  DEFAULT_HERO_IMAGE,
  DEFAULT_SITE_BRANDING,
  brandingHeroUrl,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

export function BuilderHero({ branding }: { branding: PbSiteBranding | null }) {
  const heroUrl = brandingHeroUrl(branding) || DEFAULT_HERO_IMAGE;
  const main = branding?.hero_title_main || DEFAULT_SITE_BRANDING.hero_title_main;
  const highlight =
    branding?.hero_title_highlight || DEFAULT_SITE_BRANDING.hero_title_highlight;
  const subtitle =
    branding?.hero_subtitle || DEFAULT_SITE_BRANDING.hero_subtitle;

  return (
    <section
      className="builder-hero relative flex min-h-[52vh] items-end sm:min-h-[58vh]"
      aria-label="Hero"
    >
      {/*
        Clip wrapper: keeps the fixed/parallax photo visible only within the hero.
        As the cream builder card scrolls up, it covers this clipped region.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* True fixed parallax photo (bg-fixed on desktop; fixed-position fallback on iOS) */}
        <div
          className="builder-hero-bg absolute inset-0 bg-[#F5F0E8] bg-cover bg-center bg-no-repeat bg-fixed"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />
        {/* Tight left cream dégradé — keeps pagoda/sky clear on the right */}
        <div className="absolute inset-y-0 left-0 w-[78%] md:w-[70%] bg-gradient-to-r from-[#FBF8F2]/95 via-[#FBF8F2]/55 to-transparent" />
        {/* Soft bottom blend into the cream content shell only */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F5F0E8]/85 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-20 pt-28 sm:px-8 sm:pb-24">
        <h1 className="max-w-xl font-display text-4xl leading-[1.08] uppercase tracking-[0.04em] sm:text-5xl md:text-[3.35rem]">
          <span className="text-[#0B1F3A]">{main}</span>
          <br />
          <span className="text-[#C4A35A]">{highlight}</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#3D4A5C] sm:text-base">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
