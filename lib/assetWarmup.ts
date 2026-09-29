/**
 * Eager asset warmup — characters + key posters/videos for Pre-Elite / builders.
 * Call from home gate + root preloader so swaps never wait on first paint.
 */

import { BRAND_CHARACTER_PRELOAD_PATHS } from "@/lib/brandCharacters";
import { BRAND_LOGO_ICON } from "@/lib/brand";

/** Light UI images that must be in cache before trip flow feels snappy. */
export const WARM_IMAGE_PATHS: readonly string[] = [
  ...BRAND_CHARACTER_PRELOAD_PATHS,
  BRAND_LOGO_ICON,
  "/images/peek-character-1day.png",
  "/images/peek-character.png",
  "/images/matcher-poster.webp",
  "/images/matcher-poster-card.webp",
  "/images/concierge-poster.webp",
  "/images/concierge-poster-card.webp",
];

/** Key explainer reels — start download on home, not when a modal opens. */
export const WARM_VIDEO_PATHS: readonly string[] = [
  "/videos/elite-concierge-preview.mp4",
  "/videos/activity-matcher-guide.mp4",
];

export type WarmProgress = {
  loaded: number;
  total: number;
  /** 0–100 */
  percent: number;
  done: boolean;
};

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    const finish = () => resolve();
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
    if (img.complete) finish();
  });
}

/** Kick browser cache for a video without blocking forever on huge files. */
function warmVideo(src: string, timeoutMs = 12_000): Promise<void> {
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
    video.addEventListener(
      "canplaythrough",
      () => {
        window.clearTimeout(t);
        finish();
      },
      { once: true }
    );
    video.addEventListener(
      "error",
      () => {
        window.clearTimeout(t);
        finish();
      },
      { once: true }
    );
    // loadeddata is enough to avoid first-open blank on many devices
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
 * Warm all critical assets. Reports progress via `onProgress`.
 * Images are required; videos count toward progress but time out so
 * a dead CDN cannot trap the home gate forever.
 */
export async function warmCriticalAssets(
  onProgress?: (p: WarmProgress) => void
): Promise<void> {
  const images = [...new Set(WARM_IMAGE_PATHS)];
  const videos = [...new Set(WARM_VIDEO_PATHS)];
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

  await Promise.all([
    ...images.map((src) => loadImage(src).then(tick)),
    ...videos.map((src) => warmVideo(src).then(tick)),
  ]);
}

/** Fire-and-forget warm (root layout) — no UI gate. */
export function startBackgroundWarm(): void {
  if (typeof window === "undefined") return;
  void warmCriticalAssets();
}
