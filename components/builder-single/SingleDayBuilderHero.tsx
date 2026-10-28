"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
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
import {
  brandingSlotSrcSet,
  brandingSlotVersionedUrl,
  builderHeroSlot,
} from "@/lib/brandingImageSlots";
import { preEliteMediaVersion } from "@/lib/preEliteBranding";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import {
  fetchPublicBrandAssets,
} from "@/lib/pocketbase/client";

/** Single-day peek character (1-Day Pass ticket) */
const HERO_CHARACTER_SRC = "/images/peek-character-1day.webp";

/* Hero renders the builder-single-hero slot; missing slot → grey. */

/**
 * Builder S hero — Team Branding still/video (poster-first) + peek character + copy.
 * Prefer admin poster / public still; empty → plain grey (never logo filler).
 *
 * Section 1 of the two-section builder landing: full-screen (100dvh).
 * `onStartBuilding` renders the bottom "Start Building" scroll cue that
 * smooth-scrolls to Section 2 (the builder UI).
 */
export function SingleDayBuilderHero({
  onStartBuilding,
}: {
  onStartBuilding?: () => void;
}) {
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

  void publicHero;
  void item;
  // The ONE Single-Day hero slot (version from the hero record's
  // media_version, or the local cache written on save in admin).
  const slotVersion = preEliteMediaVersion(
    brandingItems[SINGLE_DAY_BUILDER_HERO_KEY]
  );
  const localSlot =
    localCache?.mediaUrl &&
    localCache.mediaUrl.includes(builderHeroSlot("single"))
      ? localCache.mediaUrl
      : "";
  const stillSrc =
    localSlot ||
    brandingSlotVersionedUrl(builderHeroSlot("single"), slotVersion);
  const [heroOk, setHeroOk] = useState(true);

  return (
    <section
      className="builder-hero relative z-10 flex h-[calc(100dvh-3.75rem)] w-full flex-col overflow-hidden bg-[#05080C] pb-24 lg:h-[100dvh]"
      aria-label="Single-day builder hero"
    >
      {heroOk ? (
        // Plain <img>: versioned /uploads/ URLs must never go to next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stillSrc}
          srcSet={brandingSlotSrcSet(builderHeroSlot("single"))}
          sizes="100vw"
          alt=""
          width={1600}
          height={900}
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

      {onStartBuilding ? (
        // In-flow at the end of the flex column (mt-auto) + section pb-24,
        // so the cue always sits above the mobile bottom nav / fold,
        // whatever the screen height.
        <div className="relative z-30 mt-auto flex justify-center">
          <button
            type="button"
            onClick={onStartBuilding}
            aria-label="Start building your day"
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
