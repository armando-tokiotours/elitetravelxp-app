"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useCurtainStore } from "@/store/useCurtainStore";

const DURATION = 0.8;
const EASE = [0.76, 0, 0.24, 1] as const;
/** Beat after the new route paints behind the curtain before revealing it. */
const REVEAL_BEAT_MS = 160;
/** Never trap the user behind the curtain if navigation stalls. */
const SAFETY_MS = 2500;

/**
 * Solid pink curtain wipe for the landing selector → Prebuilder Quiz entry.
 * Mounted once in the root providers so it survives the real route change:
 * slide in (100% → 0%) → router.push at full cover → brief beat →
 * slide out (0% → −100%) → idle. See store/useCurtainStore.
 */
export function CurtainWipe() {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const pendingRoute = useCurtainStore((s) => s.pendingRoute);
  const phase = useCurtainStore((s) => s.phase);
  const setPhase = useCurtainStore((s) => s.setPhase);
  const clear = useCurtainStore((s) => s.clear);

  const targetRouteRef = useRef<string | null>(null);
  const originUrlRef = useRef<string | null>(null);
  const pushedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
    if (safetyTimerRef.current != null)
      window.clearTimeout(safetyTimerRef.current);
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    exitTimerRef.current = null;
    safetyTimerRef.current = null;
    pollRef.current = null;
  }, []);

  // Removing the curtain (phase → idle) runs its exit slide to −100%.
  const triggerExit = useCallback(() => {
    const current = useCurtainStore.getState().phase;
    if (current === "idle") return;
    clearTimers();
    clear();
  }, [clearTimers, clear]);

  const scheduleExit = useCallback(() => {
    if (useCurtainStore.getState().phase !== "awaiting-route") return;
    if (exitTimerRef.current != null) return;
    exitTimerRef.current = window.setTimeout(triggerExit, REVEAL_BEAT_MS);
  }, [triggerExit]);

  // ── Reduced motion: skip the curtain, navigate immediately ──────────────
  useEffect(() => {
    if (!pendingRoute || !reduceMotion) return;
    if (useCurtainStore.getState().phase !== "covering") return;
    clear();
    router.push(pendingRoute);
  }, [pendingRoute, reduceMotion, router, clear]);

  // ── Capture origin when a (non-reduced) cover starts ────────────────────
  useEffect(() => {
    if (phase !== "covering" || reduceMotion) return;
    if (targetRouteRef.current === pendingRoute && pushedRef.current) return;
    targetRouteRef.current = pendingRoute;
    originUrlRef.current = `${window.location.pathname}${window.location.search}`;
    pushedRef.current = false;
  }, [phase, pendingRoute, reduceMotion]);

  // ── Route-change detection (pathname; poll covers search-only) ──────────
  useEffect(() => {
    if (phase !== "awaiting-route" || !originUrlRef.current) return;
    const originPath = originUrlRef.current.split("?")[0];
    if (pathname && pathname !== originPath) scheduleExit();
  }, [pathname, phase, scheduleExit]);

  useEffect(() => clearTimers, [clearTimers]);

  // Fires only for the cover animation: at full cover, swap the route.
  const handleAnimationComplete = useCallback(() => {
    if (useCurtainStore.getState().phase !== "covering") return;
    const route = targetRouteRef.current ?? pendingRoute;
    if (!route || pushedRef.current) return;
    pushedRef.current = true;
    if (!originUrlRef.current) {
      originUrlRef.current = `${window.location.pathname}${window.location.search}`;
    }
    setPhase("awaiting-route");
    router.push(route);

    // Safety: exit anyway if the route never actually changes.
    safetyTimerRef.current = window.setTimeout(triggerExit, SAFETY_MS);
    // Poll for search-only changes (usePathname alone would miss them).
    pollRef.current = window.setInterval(() => {
      if (useCurtainStore.getState().phase !== "awaiting-route") return;
      const now = `${window.location.pathname}${window.location.search}`;
      if (originUrlRef.current && now !== originUrlRef.current) {
        if (pollRef.current != null) window.clearInterval(pollRef.current);
        pollRef.current = null;
        scheduleExit();
      }
    }, 80);
  }, [pendingRoute, router, scheduleExit, setPhase, triggerExit]);

  const handleExitComplete = useCallback(() => {
    clearTimers();
    targetRouteRef.current = null;
    originUrlRef.current = null;
    pushedRef.current = false;
  }, [clearTimers]);

  const showCurtain = phase !== "idle" && !reduceMotion;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {showCurtain ? (
        <motion.div
          key="curtain-wipe"
          aria-hidden
          className="fixed inset-0 z-[9999] bg-[#FF0055]"
          initial={{ x: "100%" }}
          animate={{ x: "0%" }}
          exit={{ x: "-100%" }}
          transition={{ duration: DURATION, ease: EASE }}
          onAnimationComplete={handleAnimationComplete}
        />
      ) : null}
    </AnimatePresence>
  );
}
