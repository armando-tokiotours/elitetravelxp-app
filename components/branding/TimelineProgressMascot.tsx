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
 * Stacked opacity crossfade only — never remount/scale on pose.
 * Activity only resets pose when leaving look (no snap blink).
 * Tap → HI bubble (2.5s) + zoom pulse.
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
  const poseRef = useRef<Pose>("look");
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    const clear = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      if (noteRef.current) clearTimeout(noteRef.current);
      idleRef.current = null;
      noteRef.current = null;
    };

    const scheduleIdle = () => {
      clear();
      idleRef.current = setTimeout(() => {
        setPose("time");
        poseRef.current = "time";
        noteRef.current = setTimeout(() => {
          setPose("note");
          poseRef.current = "note";
        }, noteAfterMs);
      }, idleMs);
    };

    const bump = () => {
      // Only snap back when actually idle — avoids look↔look re-renders
      // and the blinky jump when the mouse twitches during look.
      if (poseRef.current !== "look") {
        setPose("look");
        poseRef.current = "look";
      }
      scheduleIdle();
    };

    scheduleIdle();
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
      <HiBubble
        show={showHi}
        className="-left-1 -top-5 w-[4.75rem] sm:left-0 sm:-top-6 sm:w-[5.5rem]"
      />
      <MascotHiZoom
        showHi={showHi}
        className="pointer-events-none absolute inset-0 flex items-end justify-center"
      >
        {(Object.keys(POSES) as Pose[]).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p}
            src={POSES[p]}
            alt=""
            className={`absolute bottom-0 h-[130%] w-auto max-w-none origin-bottom object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-opacity duration-700 ease-in-out ${
              pose === p ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        ))}
      </MascotHiZoom>
    </div>
  );
}
