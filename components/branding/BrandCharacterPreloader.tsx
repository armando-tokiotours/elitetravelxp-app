"use client";

import { useEffect } from "react";
import { BRAND_CHARACTER_PRELOAD_PATHS } from "@/lib/brandCharacters";

/**
 * Warm-caches all brand character WebPs in the background as soon as the
 * shell mounts — so step/mascot swaps paint from cache instead of waiting.
 */
export function BrandCharacterPreloader() {
  useEffect(() => {
    let cancelled = false;
    const paths = BRAND_CHARACTER_PRELOAD_PATHS;

    const warm = () => {
      if (cancelled) return;
      for (const src of paths) {
        const img = new window.Image();
        img.decoding = "async";
        img.src = src;
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const t = window.setTimeout(warm, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
