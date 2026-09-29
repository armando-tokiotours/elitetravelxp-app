"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";

const POSES = {
  look: "/brand/mascot-look.webp",
  time: "/brand/mascot-time.webp",
  note: "/brand/mascot-note.webp",
} as const;

type Pose = keyof typeof POSES;

/**
 * Tiny sticky-timeline mascot — look while active;
 * idle → time, then note (loops until user moves again).
 * Opacity crossfade only — no scale remount blink.
 * Tap → HI bubble (1s) + zoom pulse.
 */
export function TimelineProgressMascot({
  idleMs = 7_000,
  noteAfterMs = 4_000,
  className = "",
}: {
  idleMs?: number;
  noteAfterMs?: number;
  className?: string;
}) {
  const [pose, setPose] = useState<Pose>("look");
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  useEffect(() => {
    const clear = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      if (noteRef.current) clearTimeout(noteRef.current);
    };

    const bump = () => {
      setPose("look");
      clear();
      idleRef.current = setTimeout(() => {
        setPose("time");
        noteRef.current = setTimeout(() => setPose("note"), noteAfterMs);
      }, idleMs);
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
      clear();
    };
  }, [idleMs, noteAfterMs]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Say hi"
      onClick={triggerHi}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") triggerHi(e);
      }}
      className={`relative z-20 flex h-[3.575rem] w-[3.575rem] shrink-0 cursor-pointer items-end justify-center overflow-visible sm:h-[3.9rem] sm:w-[3.9rem] ${className}`}
    >
      <HiBubble show={showHi} className="-left-2 -top-10 sm:-top-11" />
      <MascotHiZoom showHi={showHi} className="pointer-events-none absolute inset-0 flex items-end justify-center">
        {(Object.keys(POSES) as Pose[]).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p}
            src={POSES[p]}
            alt=""
            className={`absolute bottom-0 h-[130%] w-auto max-w-none origin-bottom object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-opacity duration-300 ${
              pose === p ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        ))}
      </MascotHiZoom>
    </div>
  );
}
