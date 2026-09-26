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
 */
export function IdleHeroMascot({
  activeSrc = "/brand/mascot-phone.png",
  idleSrc = "/brand/mascot-time.png",
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

  const src = isIdle ? idleSrc : activeSrc;
  const key = isIdle ? "idle" : "active";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={key}
      src={src}
      alt=""
      aria-hidden
      className={className}
    />
  );
}
