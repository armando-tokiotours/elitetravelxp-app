"use client";

import { useEffect, useRef, useState } from "react";

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
 */
export function IdleHeroMascot({
  activeSrc = "/brand/mascot-phone.webp",
  idleSrc = "/brand/mascot-time.webp",
  idleMs = 7_000,
  className,
}: IdleHeroMascotProps) {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <span className={`relative inline-block ${className || ""}`} aria-hidden>
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
        className={`pointer-events-none absolute inset-0 h-full w-auto object-contain transition-opacity duration-300 ${
          isIdle ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
