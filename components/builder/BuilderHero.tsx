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

/** Parallax lag vs page scroll — keeps pagoda framed without a rigid fixed crop. */
const PARALLAX_RATE = 0.35;

export function BuilderHero({ branding }: { branding: PbSiteBranding | null }) {
  const [heroUrl, setHeroUrl] = useState(
    () => brandingHeroUrl(branding) || DEFAULT_HERO_IMAGE
  );
  const [scrollY, setScrollY] = useState(0);
  const subtitle =
    branding?.hero_subtitle?.trim() ||
    DEFAULT_SITE_BRANDING.hero_subtitle ||
    HERO_SUBTITLE_DEFAULT;
  const subtitleBreak = subtitle.match(/^(Design every detail)\s*(.*)$/i);
  const subtitleLine2 = subtitleBreak?.[2]?.replace(/\.$/, "").trim();

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

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY || 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section
      className="builder-hero relative z-10 h-[65vh] max-h-[560px] w-full min-h-[280px] overflow-hidden sm:h-[75vh] sm:max-h-none md:min-h-[420px]"
      aria-label="Hero"
    >
      {/* Scroll-driven parallax layer — taller than viewport, bottom-anchored subject */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[10%] h-[120%] w-full will-change-transform"
        style={{
          transform: `translate3d(0, ${scrollY * PARALLAX_RATE}px, 0)`,
        }}
      >
        <div
          className="builder-hero-bg absolute inset-0 bg-[#000000] bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#121212] via-black/50 to-transparent sm:h-48" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-transparent" />
      </div>

      {/* Foreground copy — scrolls with the page at full rate */}
      <div className="relative z-10 flex h-full items-center justify-start px-5 pb-14 pt-16 sm:px-8 sm:pb-16 sm:pt-20 md:px-12">
        <div className="flex max-w-[min(100%,28rem)] flex-col items-start text-left md:max-w-2xl">
          <h1 className="builder-hero-title flex flex-col items-start uppercase leading-none">
            <span className="text-[#F5EFE6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              BUILD
            </span>
            <span className="text-[0.8em] text-[#F5EFE6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              YOUR PERFECT
            </span>
            <span className="text-[#F5EFE6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              JAPAN TRIP
            </span>
          </h1>

          <div className="mt-4 bg-black/70 px-4 py-1.5 shadow-sm">
            <p className="text-sm font-medium text-white md:text-base">
              {subtitleBreak ? (
                <>
                  Design every detail
                  <br />
                  {subtitleLine2 || "we'll take care of the rest"}
                </>
              ) : (
                subtitle
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
