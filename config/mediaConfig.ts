/**
 * Single-Day Builder media + copy defaults.
 * Swap assets via env vars, this file, public/brand/hero-single-day.*, or
 * PocketBase `branding_ui_items` key `single_day_builder_hero`:
 *   title → script overlay · cta_primary → main title prefix · subtitle → tagline
 *   media / poster → hero background
 */

export const SINGLE_DAY_BUILDER_HERO_KEY = "single_day_builder_hero";

/** Public brand path written by Site Branding → “save to public assets”. */
export const SINGLE_DAY_HERO_PUBLIC_FALLBACK = "/brand/hero-single-day.jpg";

/** localStorage mirror so Builder S hero updates instantly after admin save. */
export const BUILDER_S_HERO_LS_KEY = "tokio_builder_s_hero";

export type BuilderSHeroLocalCache = {
  scriptAccent: string;
  mainTitlePrefix: string;
  tagline: string;
  mediaUrl?: string;
  updatedAt: number;
};

export function readBuilderSHeroLocalCache(): BuilderSHeroLocalCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BUILDER_S_HERO_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuilderSHeroLocalCache;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBuilderSHeroLocalCache(
  cache: Omit<BuilderSHeroLocalCache, "updatedAt"> & { updatedAt?: number }
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: BuilderSHeroLocalCache = {
      scriptAccent: cache.scriptAccent,
      mainTitlePrefix: cache.mainTitlePrefix,
      tagline: cache.tagline,
      mediaUrl: cache.mediaUrl,
      updatedAt: cache.updatedAt ?? Date.now(),
    };
    localStorage.setItem(BUILDER_S_HERO_LS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export const SINGLE_DAY_BUILDER_CONFIG = {
  hero: {
    /** @deprecated Prefer scriptAccent; kept for older callers */
    title: "SINGLE-DAY EXPERIENCES",
    scriptAccent: "Japan!",
    mainTitlePrefix: "YOUR DAY IN",
    subtitle:
      "Curated 1-day immersive discovery across Japan's finest districts.",
    videoUrl:
      process.env.NEXT_PUBLIC_SINGLE_BUILDER_HERO_VIDEO ||
      "/videos/tokyo-day-hero.mp4",
    fallbackImage:
      process.env.NEXT_PUBLIC_SINGLE_BUILDER_HERO_IMG ||
      "/images/tokyo-day-hero.jpg",
  },
  sections: {
    cityThumbnails: {
      tokyo: "/images/cities/tokyo-thumb.jpg",
      kyoto: "/images/cities/kyoto-thumb.jpg",
      nikko: "/images/cities/nikko-thumb.jpg",
      osaka: "/images/cities/osaka-thumb.jpg",
      hakone: "/images/cities/hakone-thumb.jpg",
    } as Record<string, string>,
    reelsDefaultPoster: "/images/reels/default-poster.jpg",
  },
} as const;

/** Normalize a city name to a config thumbnail key. */
export function cityThumbnailKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Prefer live PocketBase city photo; fall back to mediaConfig keyed thumbnails.
 */
export function resolveSingleDayCityThumbnail(
  cityName: string,
  pocketBaseUrl?: string | null
): string {
  if (pocketBaseUrl) return pocketBaseUrl;
  const key = cityThumbnailKey(cityName);
  const map = SINGLE_DAY_BUILDER_CONFIG.sections.cityThumbnails;
  return (
    map[key] ||
    map[key.replace(/_/g, "")] ||
    Object.entries(map).find(([k]) => key.includes(k) || k.includes(key))?.[1] ||
    SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage
  );
}

/** Prefer tour media; fall back to configured reel poster. */
export function resolveSingleDayReelPoster(
  pocketBaseUrl?: string | null
): string {
  return (
    pocketBaseUrl ||
    SINGLE_DAY_BUILDER_CONFIG.sections.reelsDefaultPoster ||
    SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage
  );
}
