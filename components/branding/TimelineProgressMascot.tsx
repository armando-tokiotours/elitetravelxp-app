"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const POSES = {
  look: "/brand/mascot-look.png",
  time: "/brand/mascot-time.png",
  note: "/brand/mascot-note.png",
} as const;

type Pose = keyof typeof POSES;

/**
 * Tiny sticky-timeline mascot — look while active;
 * idle → time, then note (loops until user moves again).
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
      className={`pointer-events-none relative z-20 flex h-[3.575rem] w-[3.575rem] shrink-0 items-end justify-center overflow-visible sm:h-[3.9rem] sm:w-[3.9rem] ${className}`}
      aria-hidden
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={pose}
          src={POSES[pose]}
          alt=""
          initial={{ opacity: 0, y: 4, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -2, scale: 0.94 }}
          transition={{ duration: 0.28 }}
          className="h-[130%] w-auto max-w-none origin-bottom object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
          draggable={false}
        />
      </AnimatePresence>
    </div>
  );
}
