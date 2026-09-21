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

/** Optional looping hero video (place at public/brand/hero-japan-bg.mp4). */
const HERO_VIDEO_SRC = "/brand/hero-japan-bg.mp4";

/** Parallax lag vs page scroll — keeps pagoda framed without a rigid fixed crop. */
const PARALLAX_RATE = 0.35;

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function BuilderHero({ branding }: { branding: PbSiteBranding | null }) {
  const [heroUrl, setHeroUrl] = useState(
    () => brandingHeroUrl(branding) || DEFAULT_HERO_IMAGE
  );
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const subtitle =
    branding?.hero_subtitle?.trim() ||
    DEFAULT_SITE_BRANDING.hero_subtitle ||
    HERO_SUBTITLE_DEFAULT;
  const subtitleBreak = subtitle.match(/^(Design every detail)\s*(.*)$/i);
  const subtitleLine2 = subtitleBreak?.[2]?.replace(/\.$/, "").trim();

  const posterUrl = isVideoUrl(heroUrl) ? DEFAULT_HERO_IMAGE : heroUrl;
  const useVideo = videoAvailable || isVideoUrl(heroUrl);
  const videoSrc = isVideoUrl(heroUrl) ? heroUrl : HERO_VIDEO_SRC;

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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(HERO_VIDEO_SRC, { method: "HEAD" });
        if (!cancelled) setVideoAvailable(res.ok);
      } catch {
        if (!cancelled) setVideoAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#121212] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Hero"
    >
      {/* Scroll-driven parallax media layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[8%] h-[116%] w-full will-change-transform"
        style={{
          transform: `translate3d(0, ${scrollY * PARALLAX_RATE}px, 0)`,
        }}
      >
        {useVideo ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={posterUrl}
            className="absolute inset-0 h-full w-full object-cover object-bottom sm:object-center"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="builder-hero-bg absolute inset-0 h-full w-full object-cover object-bottom sm:object-[center_70%]"
          />
        )}

        {/* Soft top shade for title contrast */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Full-height dissolve into charcoal */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#121212]" />

        {/* Extended bottom fade (120–180px) — overlaps where the builder card sits */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-[#121212]/80 to-[#121212] sm:h-44" />
      </div>

      {/* Foreground copy — scrolls with the page at full rate */}
      <div className="relative z-10 flex h-full items-center justify-start px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 md:px-12">
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
