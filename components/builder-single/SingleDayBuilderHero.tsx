"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  BUILDER_S_HERO_CONFIG,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import {
  BUILDER_S_HERO_LS_KEY,
  SINGLE_DAY_BUILDER_CONFIG,
  SINGLE_DAY_BUILDER_HERO_KEY,
  SINGLE_DAY_HERO_PUBLIC_FALLBACK,
  readBuilderSHeroLocalCache,
  type BuilderSHeroLocalCache,
} from "@/config/mediaConfig";
import { isVideoFilename } from "@/lib/brandingUi";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import {
  fetchPublicBrandAssets,
} from "@/lib/pocketbase/client";

/** Single-day peek character (1-Day Pass ticket) */
const HERO_CHARACTER_SRC = "/images/peek-character-1day.webp";

/** Logo / ENOENT stubs — never use as full-bleed hero (plain grey instead). */
const HERO_MEDIA_STUBS = new Set([
  "/brand/tokiotours-logo-icon.png",
  "/brand/hero-single-day.jpg",
  "/brand/hero-background.jpg",
  "/brand/hero-japan-pagoda.jpg",
  "/brand/site-logo.png",
]);

function realHeroMedia(url: string | undefined | null): string {
  const u = (url || "").trim();
  if (!u || HERO_MEDIA_STUBS.has(u)) return "";
  return u;
}

/**
 * Builder S hero — Team Branding still/video (poster-first) + peek character + copy.
 * Prefer admin poster / public still; empty → plain grey (never logo filler).
 */
export function SingleDayBuilderHero() {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  const [localCache, setLocalCache] = useState<BuilderSHeroLocalCache | null>(
    null
  );
  const [publicHero, setPublicHero] = useState(SINGLE_DAY_HERO_PUBLIC_FALLBACK);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    setLocalCache(readBuilderSHeroLocalCache());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BUILDER_S_HERO_LS_KEY) {
        setLocalCache(readBuilderSHeroLocalCache());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBrandAssets().then((assets) => {
      if (cancelled) return;
      if (assets.hero_single) setPublicHero(assets.hero_single);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const item = getItem(SINGLE_DAY_BUILDER_HERO_KEY);
  const team = BUILDER_S_HERO_CONFIG;
  const fromPb = resolveBuilderSHeroCopy(item);
  const scriptAccent =
    localCache?.scriptAccent?.trim() || fromPb.scriptAccent || "Japan!";
  const heroSubtitle =
    localCache?.tagline?.trim() ||
    fromPb.tagline ||
    "Custom 1-Day Private Route & Instant Quote";
  const heroLine1 = team.heroLine1;
  const heroLine2 = team.heroLine2;

  const mediaUrl = realHeroMedia(
    localCache?.mediaUrl ||
      item.mediaUrl ||
      publicHero ||
      SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage
  );
  const isVideo = isVideoFilename(mediaUrl);
  const posterUrl = realHeroMedia(
    item.posterUrl ||
      publicHero ||
      SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage
  );

  const stillSrc = mediaUrl || posterUrl;
  const stillIsLocal =
    Boolean(stillSrc) &&
    stillSrc!.startsWith("/") &&
    !stillSrc!.startsWith("//");

  return (
    <section
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#05080C] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Single-day builder hero"
    >
      {isVideo && mediaUrl ? (
        <LazyVideo
          src={mediaUrl}
          poster={posterUrl || undefined}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay
        />
      ) : stillSrc && stillIsLocal ? (
        <Image
          src={stillSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 object-cover"
        />
      ) : stillSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stillSrc}
          alt=""
          width={1600}
          height={900}
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
        alt="Tokiotours 1-Day Express Pass mascot"
        width={280}
        height={300}
        priority
        sizes="(max-width: 640px) 180px, 280px"
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-[230px] w-auto select-none object-contain object-left-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[300px]"
      />

      <div className="absolute top-1/2 left-4 z-30 flex max-w-[85%] -translate-y-1/2 flex-col items-start text-left sm:left-12 sm:max-w-md">
        <h1 className="flex flex-col items-start text-left leading-tight">
          <span className="relative z-10 -mb-6 translate-y-1 font-beauty text-[3.3rem] font-normal leading-none text-[#E11D48] drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:-mb-9 sm:translate-y-1.5 sm:text-[5.28rem]">
            {scriptAccent}
          </span>
          <span className="font-hanson text-[1.95rem] font-black tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-[2.925rem]">
            {heroLine1}
          </span>
          <span className="-mt-3 font-hanson text-2xl font-black leading-none tracking-wider text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:-mt-3.5 sm:text-4xl">
            {heroLine2}
          </span>
        </h1>
        <p className="-mt-1 max-w-[16rem] font-futura text-xs font-medium leading-snug text-zinc-300 opacity-90 sm:max-w-sm sm:text-sm">
          {heroSubtitle}
        </p>
      </div>
    </section>
  );
}
