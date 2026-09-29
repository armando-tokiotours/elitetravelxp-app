"use client";

import { useEffect } from "react";
import { startBackgroundWarm } from "@/lib/assetWarmup";

/**
 * Starts character + video warmup immediately on shell mount
 * (no idle delay — slow networks need the head start).
 */
export function BrandCharacterPreloader() {
  useEffect(() => {
    startBackgroundWarm();
  }, []);

  return null;
}
