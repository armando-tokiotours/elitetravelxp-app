"use client";

import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 767;

/**
 * Viewport switch for dedicated mobile vs desktop layouts.
 * Defaults to `false` (desktop) until mount to avoid SSR/hydration flash.
 */
export function useIsMobile(breakpointPx = MOBILE_MAX_WIDTH): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);

  return isMobile;
}
