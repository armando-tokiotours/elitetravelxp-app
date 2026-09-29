"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";

type IdleHeroMascotProps = {
  /** Default pose (e.g. phone) */
  activeSrc?: string;
  /** After idleMs with no activity */
  idleSrc?: string;
  idleMs?: number;
  className?: string;
};

/**
 * Hero mascot that swaps to an idle pose after inactivity,
 * then returns to the active pose on mouse / scroll / click / key.
 * Crossfade without remount/scale so the swap does not blink.
 * Tap → HI bubble (2.5s) + zoom pulse.
 */
export function IdleHeroMascot({
  activeSrc = "/brand/mascot-phone.webp",
  idleSrc = "/brand/mascot-time.webp",
  idleMs = 7_000,
  className,
}: IdleHeroMascotProps) {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  useEffect(() => {
    const bump = () => {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), idleMs);
    };
    bump();
    window.addEventListener("mousemove", bump, { passive: true });
    window.addEventListener("mousedown", bump);
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("touchstart", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("scroll", bump, true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [idleMs]);

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Say hi"
      onClick={triggerHi}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") triggerHi(e);
      }}
      className={`relative inline-block cursor-pointer ${className || ""}`}
    >
      <HiBubble show={showHi} className="-right-1 -top-1 w-[5.5rem] sm:-top-2 sm:w-[6.5rem]" />
      <MascotHiZoom showHi={showHi} className="pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt=""
          draggable={false}
          className={`h-full w-auto object-contain transition-opacity duration-300 ${
            isIdle ? "opacity-0" : "opacity-100"
          }`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={idleSrc}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-auto object-contain transition-opacity duration-300 ${
            isIdle ? "opacity-100" : "opacity-0"
          }`}
        />
      </MascotHiZoom>
    </span>
  );
}
