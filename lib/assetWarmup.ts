/**
 * Speed-test warm — icons + characters only.
 * Heroes / story photos / posters / videos intentionally excluded
 * so home + builder handoff stay near-instant on VPS.
 */

import { BRAND_CHARACTER_PRELOAD_PATHS } from "@/lib/brandCharacters";
import { BRAND_LOGO_ICON } from "@/lib/brand";

/** Characters + tiny brand marks only — no photos, heroes, or posters. */
export const WARM_IMAGE_PATHS: readonly string[] = [
  ...BRAND_CHARACTER_PRELOAD_PATHS,
  BRAND_LOGO_ICON,
  "/brand/favicon.png",
  "/brand/1-day-pass-ico.png",
  "/brand/multy-day-icon.png",
  "/brand/fox-peek.webp",
  "/images/peek-character-1day.png",
  "/images/peek-character.png",
].filter((p) => Boolean(p) && p.startsWith("/"));

/** Videos disabled for speed test — never block navigation. */
export const WARM_VIDEO_PATHS: readonly string[] = [];

const BG_WARM_SESSION_KEY = "tokio-assets-warmed-v2";
let bgWarmStarted = false;

/** Builder entry = same light set (no hero JPGs). */
export const BUILDER_ENTRY_IMAGE_PATHS: readonly string[] = [...WARM_IMAGE_PATHS];

export const BUILDER_ENTRY_VIDEO_PATHS: readonly string[] = [];

export type WarmProgress = {
  loaded: number;
  total: number;
  /** 0–100 */
  percent: number;
  done: boolean;
};

const warmedImageSrcs = new Set<string>();

function loadImage(src: string): Promise<void> {
  if (warmedImageSrcs.has(src)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    const finish = () => {
      warmedImageSrcs.add(src);
      resolve();
    };
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
    if (img.complete) finish();
  });
}

/** Kick browser cache for a video without blocking forever on huge files. */
function warmVideo(src: string, timeoutMs = 6_000): Promise<void> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve();
    };
    const t = window.setTimeout(finish, timeoutMs);
    video.addEventListener("error", finish, { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        window.clearTimeout(t);
        finish();
      },
      { once: true }
    );
    video.src = src;
  });
}

/**
 * Warm critical assets. Reports progress via `onProgress`.
 * Speed test: images only (characters/icons); videos list is empty.
 */
export async function warmCriticalAssets(
  onProgress?: (p: WarmProgress) => void
): Promise<void> {
  return warmAssetLists(WARM_IMAGE_PATHS, WARM_VIDEO_PATHS, onProgress);
}

/** Pre-Build → Builder: same light character/icon set. */
export async function warmBuilderEntryAssets(
  onProgress?: (p: WarmProgress) => void
): Promise<void> {
  return warmAssetLists(
    BUILDER_ENTRY_IMAGE_PATHS,
    BUILDER_ENTRY_VIDEO_PATHS,
    onProgress
  );
}

async function warmAssetLists(
  imagePaths: readonly string[],
  videoPaths: readonly string[],
  onProgress?: (p: WarmProgress) => void
): Promise<void> {
  const images = [...new Set(imagePaths)];
  const videos = [...new Set(videoPaths)];
  const total = images.length + videos.length;
  let loaded = 0;

  const tick = () => {
    loaded += 1;
    const percent = total === 0 ? 100 : Math.round((loaded / total) * 100);
    onProgress?.({
      loaded,
      total,
      percent,
      done: loaded >= total,
    });
  };

  onProgress?.({ loaded: 0, total, percent: 0, done: total === 0 });

  if (total === 0) return;

  await Promise.all([
    ...images.map((src) => loadImage(src).then(tick)),
    ...videos.map((src) => warmVideo(src).then(tick)),
  ]);
}

/**
 * Fire-and-forget warm (root layout) — no UI gate.
 * Idle path: images only; does not mark session fully warm.
 */
export function startBackgroundWarm(opts?: { idleOnly?: boolean }): void {
  if (typeof window === "undefined") return;
  if (bgWarmStarted) return;
  try {
    if (sessionStorage.getItem(BG_WARM_SESSION_KEY) === "1") return;
  } catch {
    /* private mode */
  }
  bgWarmStarted = true;

  const imagesOnly = Boolean(opts?.idleOnly);
  void warmAssetLists(
    WARM_IMAGE_PATHS,
    imagesOnly ? [] : WARM_VIDEO_PATHS
  ).finally(() => {
    if (imagesOnly) return;
    try {
      sessionStorage.setItem(BG_WARM_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  });
}
