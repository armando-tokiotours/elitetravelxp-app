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
 * idle → time, then note.
 * Never drops the visible pose until the next image is loaded + decoded.
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
  const [displayPose, setDisplayPose] = useState<Pose>("look");
  const wantedRef = useRef<Pose>("look");
  const displayRef = useRef<Pose>("look");
  const loadedRef = useRef<Set<Pose>>(new Set());
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  const requestPose = (next: Pose) => {
    wantedRef.current = next;
    if (loadedRef.current.has(next)) {
      displayRef.current = next;
      setDisplayPose(next);
    }
    // else keep previous pose visible until onLoad marks next ready
  };

  const markLoaded = (p: Pose) => {
    loadedRef.current.add(p);
    if (wantedRef.current === p && displayRef.current !== p) {
      displayRef.current = p;
      setDisplayPose(p);
    }
  };

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
        requestPose("time");
        noteRef.current = setTimeout(() => {
          requestPose("note");
        }, noteAfterMs);
      }, idleMs);
    };

    const bump = () => {
      if (wantedRef.current !== "look") {
        requestPose("look");
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
            onLoad={() => markLoaded(p)}
            ref={(el) => {
              if (el?.complete && el.naturalWidth > 0) markLoaded(p);
            }}
            className={`absolute bottom-0 h-[130%] w-auto max-w-none origin-bottom object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-opacity duration-700 ease-in-out ${
              displayPose === p ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        ))}
      </MascotHiZoom>
    </div>
  );
}
