"use client";

import { useEffect, useState } from "react";
import {
  BUILDER_S_HERO_CONFIG,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import {
  BUILDER_S_HERO_LS_KEY,
  SINGLE_DAY_BUILDER_HERO_KEY,
  readBuilderSHeroLocalCache,
  type BuilderSHeroLocalCache,
} from "@/config/mediaConfig";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

/** Single-day peek character (1-Day Pass ticket) */
const HERO_CHARACTER_SRC = "/images/peek-character-1day.png";

/**
 * Builder S hero — solid dark base + peek character + copy.
 * No scenic photo/video/scrim (those caused the slow dark flash).
 */
export function SingleDayBuilderHero() {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

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

  const item = getItem(SINGLE_DAY_BUILDER_HERO_KEY);
  const team = BUILDER_S_HERO_CONFIG;
  const fromPb = resolveBuilderSHeroCopy(item);
  const scriptAccent =
    localCache?.scriptAccent?.trim() || fromPb.scriptAccent || "Japan!";
  const heroSubtitle =
    localCache?.tagline?.trim() ||
    fromPb.tagline ||
    "Curated 1-day immersive discovery across Japan's finest districts.";
  const heroLine1 = team.heroLine1;
  const heroLine2 = team.heroLine2;

  return (
    <section
      className="builder-hero relative z-10 h-[65vh] w-full min-h-[280px] overflow-hidden bg-[#05080C] sm:h-[80vh] md:min-h-[420px]"
      aria-label="Single-day builder hero"
    >
      {/* Soft bottom fade into glass card — no photo/scrim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#05080C] via-[#05080C]/40 to-transparent"
      />

      {/* Peek character */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_CHARACTER_SRC}
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-20 h-[230px] w-auto select-none object-contain object-left-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[300px]"
      />

      {/* Typography */}
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
