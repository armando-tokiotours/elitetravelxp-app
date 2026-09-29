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
 * Hero mascot that swaps to an idle pose after inactivity.
 * Keeps the previous pose visible until the idle image has loaded.
 * Tap → HI bubble (2.5s) + zoom pulse.
 */
export function IdleHeroMascot({
  activeSrc = "/brand/mascot-phone.webp",
  idleSrc = "/brand/mascot-time.webp",
  idleMs = 7_000,
  className,
}: IdleHeroMascotProps) {
  const [showIdle, setShowIdle] = useState(false);
  const idleReadyRef = useRef(false);
  const wantIdleRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  const applyIdle = (next: boolean) => {
    wantIdleRef.current = next;
    if (!next) {
      setShowIdle(false);
      return;
    }
    if (idleReadyRef.current) setShowIdle(true);
  };

  useEffect(() => {
    idleReadyRef.current = false;
    setShowIdle(false);
  }, [idleSrc]);

  useEffect(() => {
    const bump = () => {
      applyIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => applyIdle(true), idleMs);
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
      <HiBubble
        show={showHi}
        className="-right-1 -top-1 w-[5.5rem] sm:-top-2 sm:w-[6.5rem]"
      />
      <MascotHiZoom showHi={showHi} className="pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt=""
          draggable={false}
          className={`h-full w-auto object-contain transition-opacity duration-500 ${
            showIdle ? "opacity-0" : "opacity-100"
          }`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={idleSrc}
          alt=""
          draggable={false}
          onLoad={() => {
            idleReadyRef.current = true;
            if (wantIdleRef.current) setShowIdle(true);
          }}
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) {
              idleReadyRef.current = true;
              if (wantIdleRef.current) setShowIdle(true);
            }
          }}
          className={`absolute inset-0 h-full w-auto object-contain transition-opacity duration-500 ${
            showIdle ? "opacity-100" : "opacity-0"
          }`}
        />
      </MascotHiZoom>
    </span>
  );
}
