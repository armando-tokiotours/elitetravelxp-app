"use client";

import { useEffect, useState } from "react";
import {
  BUILDER_S_HERO_LS_KEY,
  SINGLE_DAY_BUILDER_CONFIG,
  SINGLE_DAY_BUILDER_HERO_KEY,
  SINGLE_DAY_HERO_PUBLIC_FALLBACK,
  readBuilderSHeroLocalCache,
  type BuilderSHeroLocalCache,
} from "@/config/mediaConfig";
import {
  BUILDER_S_HERO_CONFIG,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import { isVideoFilename } from "@/lib/brandingUi";
import {
  fetchPublicBrandAssets,
  type PublicBrandAssets,
} from "@/lib/pocketbase/client";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const HERO_SCRIM_SRC = "/images/hero-scrim-overlay.png";
const HERO_CHARACTER_SRC = "/images/peek-character.png";
const PARALLAX_RATE = 0.35;

/**
 * Full-bleed scenic hero for Builder S — mirrors Builder M `BuilderHero`
 * (media, script accent, character) with teamConfig / mediaConfig / PB overrides.
 */
export function SingleDayBuilderHero() {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  const [publicAssets, setPublicAssets] = useState<PublicBrandAssets>({});
  const [localCache, setLocalCache] = useState<BuilderSHeroLocalCache | null>(
    null
  );

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
    void (async () => {
      const assets = await fetchPublicBrandAssets();
      if (!cancelled) setPublicAssets(assets);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const item = getItem(SINGLE_DAY_BUILDER_HERO_KEY);
  const mediaCfg = SINGLE_DAY_BUILDER_CONFIG.hero;
  const team = BUILDER_S_HERO_CONFIG;
  const fromPb = resolveBuilderSHeroCopy(item);
  const scriptAccent =
    localCache?.scriptAccent?.trim() || fromPb.scriptAccent;
  const heroSubtitle = localCache?.tagline?.trim() || fromPb.tagline;
  const heroLine1 = team.heroLine1;
  const heroLine2 = team.heroLine2;

  const mediaUrl =
    localCache?.mediaUrl ||
    item.mediaUrl ||
    publicAssets.hero_single ||
    mediaCfg.videoUrl ||
    SINGLE_DAY_HERO_PUBLIC_FALLBACK;
  const posterUrl =
    (!isVideoFilename(localCache?.mediaUrl || "")
      ? localCache?.mediaUrl
      : "") ||
    item.posterUrl ||
    publicAssets.hero_single ||
    (!isVideoFilename(mediaUrl) ? mediaUrl : "") ||
    mediaCfg.fallbackImage ||
    SINGLE_DAY_HERO_PUBLIC_FALLBACK;
  const isVideo = isVideoFilename(mediaUrl);

  const [videoOk, setVideoOk] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!isVideo || !mediaUrl) {
      setVideoOk(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(mediaUrl, { method: "HEAD" });
        if (!cancelled) setVideoOk(res.ok);
      } catch {
        if (!cancelled) setVideoOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVideo, mediaUrl]);

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

  const showVideo = isVideo && videoOk;

  return (
    <section
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#05080C] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Single-day builder hero"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[8%] z-0 h-[116%] w-full will-change-transform"
        style={{
          transform: `translate3d(0, ${scrollY * PARALLAX_RATE}px, 0)`,
        }}
      >
        {showVideo ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={posterUrl}
            className="absolute inset-0 h-full w-full object-cover object-bottom sm:object-center"
          >
            <source src={mediaUrl} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl || mediaCfg.fallbackImage}
            alt=""
            className="builder-hero-bg absolute inset-0 h-full w-full object-cover object-bottom sm:object-[center_70%]"
          />
        )}
      </div>

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
