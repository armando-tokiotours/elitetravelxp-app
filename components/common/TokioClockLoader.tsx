"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const ICONS = [
  { id: "daruma", src: "/brand/icons/daruma.png", label: "Daruma" },
  { id: "torii", src: "/brand/icons/torii.png", label: "Torii" },
  { id: "fuji", src: "/brand/icons/fuji.png", label: "Mt. Fuji" },
  { id: "onigiri", src: "/brand/icons/onigiri.png", label: "Onigiri" },
  { id: "fan", src: "/brand/icons/fan.png", label: "Fan" },
  { id: "ramen", src: "/brand/icons/ramen.png", label: "Ramen" },
  { id: "ninja", src: "/brand/icons/ninja.png", label: "Ninja" },
  { id: "maneki", src: "/brand/icons/maneki.png", label: "Maneki-neko" },
] as const;

const BIKE_SRC = "/brand/icons/bike.png";
const LOOP_MS = 9_000;
const ICON_MS = 1_100;

export type TokioClockLoaderProps = {
  message?: string;
  subMessage?: string;
  /** Blurred full-viewport modal; omit for inline preview. */
  fullScreen?: boolean;
  className?: string;
};

/**
 * Brand loading bar — L-bike pulls the fill; Japan icons zoom in above the tip;
 * TOKIOTOURS sits under the track.
 */
export function TokioClockLoader({
  message = "PREPARING YOUR JOURNEY...",
  subMessage,
  fullScreen = false,
  className = "",
}: TokioClockLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    let start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) % LOOP_MS;
      setProgress((t / LOOP_MS) * 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIconIndex((i) => (i + 1) % ICONS.length);
    }, ICON_MS);
    return () => window.clearInterval(id);
  }, []);

  const icon = ICONS[iconIndex];

  const bar = (
    <div
      className={`relative flex w-full max-w-md flex-col items-center px-4 ${className}`}
      role="progressbar"
      aria-live="polite"
      aria-label={message}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div className="relative w-full pt-16 pb-2">
        {/* Tip: zooming icon + L-bike carriage */}
        <div
          className="pointer-events-none absolute bottom-2 z-20"
          style={{
            left: `${progress}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
            <AnimatePresence mode="wait">
              <motion.div
                key={icon.id}
                initial={{ scale: 0.12, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 18,
                }}
                className="flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={icon.src}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-full w-full select-none object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
                />
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">{icon.label}</span>
          </div>

          <motion.img
            src={BIKE_SRC}
            alt=""
            aria-hidden
            draggable={false}
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 0.55,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative z-10 h-14 w-auto select-none object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] sm:h-16"
          />
        </div>

        <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/10 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#054F70] via-[#1BA58A] to-[#E60F43]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-3 font-godiva text-base uppercase tracking-[0.22em] text-white sm:text-lg">
        Tokiotours
      </p>

      <div className="mt-2 max-w-sm text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80 sm:text-xs">
          {message}
        </p>
        {subMessage ? (
          <p className="mt-1.5 text-xs text-white/50 sm:text-sm">{subMessage}</p>
        ) : null}
      </div>
    </div>
  );

  if (!fullScreen) return bar;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-md">
      {bar}
    </div>
  );
}
