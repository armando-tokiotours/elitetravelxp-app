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

const HERO_SCRIM_SRC = "/images/hero-scrim-overlay.png";
const HERO_CHARACTER_SRC = "/images/peek-character.png";

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
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#05080C] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Hero"
    >
      {/* Layer 1 — scenic background (parallax) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[8%] z-0 h-[116%] w-full will-change-transform"
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
      </div>

      {/* Layer 2 — dark scrim for type/character contrast */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05080C] via-black/40 to-transparent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_SCRIM_SRC}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-multiply"
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent via-[#05080C]/85 to-[#05080C] sm:h-40" />
      </div>

      {/* Layer 3 — peek character (flush left, bottom; +10% mobile scale) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_CHARACTER_SRC}
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-[230px] w-auto select-none object-contain object-left-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[300px]"
      />

      {/* Layer 4 — hero typography (left-aligned, vertically centered) */}
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
