"use client";

import { useEffect } from "react";
import { startBackgroundWarm } from "@/lib/assetWarmup";

/**
 * Idle background warm — characters/icons only (speed test).
 * Never blocks UI; HomeAssetWarmGate also no longer blocks.
 */
export function BrandCharacterPreloader() {
  useEffect(() => {
    const run = () => startBackgroundWarm({ idleOnly: true });
    const w = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => run(), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }

    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
