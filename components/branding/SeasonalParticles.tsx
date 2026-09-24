"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  SEASONAL_FX_FADE_MS,
  SEASONAL_FX_DURATION_MS,
  useSeasonalFxStore,
} from "@/store/useSeasonalFxStore";
import type { ParticleSeason } from "@/lib/seasonality";

/** Dense flurry — ~2× the original burst. */
const PARTICLE_COUNT = 72;

type ParticleSpec = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: string;
  drift: string;
  opacity: number;
  rotate: string;
};

function buildParticles(token: number): ParticleSpec[] {
  const seed = token * 9973;
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const n = (seed + i * 7919) % 10000;
    const left = (n % 1000) / 10;
    const delay = ((n % 90) / 100) * 0.85;
    const duration = 1.85 + ((n % 55) / 100) * 1.15;
    const size = 7 + (n % 16);
    const drift = ((n % 70) - 35) * 2.2;
    const opacity = 0.4 + ((n % 45) / 100) * 0.55;
    const rotate = `${(n % 360) - 180}deg`;
    return {
      id: i,
      left: `${left}%`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      size: `${size}px`,
      drift: `${drift}px`,
      opacity,
      rotate,
    };
  });
}

function ParticleGlyph({
  season,
}: {
  season: Exclude<ParticleSeason, null>;
}) {
  if (season === "sakura") {
    return (
      <svg viewBox="0 0 24 24" className="pointer-events-none h-full w-full" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2c.4 2.8 1.6 4.6 3.6 5.4-1.6.6-2.8 2-3.6 4.2-.8-2.2-2-3.6-3.6-4.2C10.4 6.6 11.6 4.8 12 2zm0 20c-.4-2.8-1.6-4.6-3.6-5.4 1.6-.6 2.8-2 3.6-4.2.8 2.2 2 3.6 3.6 4.2C13.6 17.4 12.4 19.2 12 22zm10-10c-2.8-.4-4.6-1.6-5.4-3.6.6 1.6 2 2.8 4.2 3.6-2.2.8-3.6 2-4.2 3.6.8-2 2.6-3.2 5.4-3.6zM2 12c2.8.4 4.6 1.6 5.4 3.6-.6-1.6-2-2.8-4.2-3.6 2.2-.8 3.6-2 4.2-3.6C6.6 10.4 4.8 11.6 2 12z"
        />
        <circle cx="12" cy="12" r="2.2" fill="#FF69B4" />
      </svg>
    );
  }
  if (season === "snow") {
    return (
      <svg viewBox="0 0 24 24" className="pointer-events-none h-full w-full" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M2 12h20" />
        </g>
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.85" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="pointer-events-none h-full w-full" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3c1.2 2.4 2.8 3.6 5 3.6-1.8 1-2.8 2.6-3 4.8 2.2-.4 4-.2 5.6 1.2-2.2.8-3.6 2.2-4.2 4.4 1.6 0 3 .6 4.2 1.8-2.4.2-4.2 1.2-5.4 3.2-.4-2.2-1.4-3.8-3.2-4.8-1.8 1-2.8 2.6-3.2 4.8C6.6 21 4.8 20 2.4 19.8c1.2-1.2 2.6-1.8 4.2-1.8-.6-2.2-2-3.6-4.2-4.4 1.6-1.4 3.4-1.6 5.6-1.2-.2-2.2-1.2-3.8-3-4.8 2.2 0 3.8-1.2 5-3.6z"
      />
    </svg>
  );
}

function seasonColor(season: Exclude<ParticleSeason, null>): string {
  if (season === "sakura") return "#FFB7C5";
  if (season === "snow") return "#E0F7FA";
  return "#E11D48";
}

function seasonBadgeEmoji(season: Exclude<ParticleSeason, null>): string {
  if (season === "sakura") return "🌸";
  if (season === "snow") return "❄️";
  return "🍁";
}

/**
 * Full-screen seasonal ambient particles — dense 3s burst (incl. 0.5s fade).
 * Fixed full-viewport overlay for iOS Safari / Android Chrome; never blocks touch.
 */
export function SeasonalParticlesHost() {
  const active = useSeasonalFxStore((s) => s.active);
  const season = useSeasonalFxStore((s) => s.season);
  const badge = useSeasonalFxStore((s) => s.badge);
  const token = useSeasonalFxStore((s) => s.token);
  const clear = useSeasonalFxStore((s) => s.clear);

  const particles = useMemo(
    () => (active && season ? buildParticles(token) : []),
    [active, season, token]
  );

  // Safety clear if store timeout missed (e.g. tab backgrounded)
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => clear(), SEASONAL_FX_DURATION_MS + 50);
    return () => window.clearTimeout(t);
  }, [active, token, clear]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {active && season ? (
        <motion.div
          key={`seasonal-fx-${token}`}
          className="pointer-events-none fixed inset-0 z-[9999] h-screen w-screen overflow-hidden"
          style={{
            transform: "translate3d(0,0,0)",
            WebkitTransform: "translate3d(0,0,0)",
            touchAction: "none",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: SEASONAL_FX_FADE_MS / 1000, ease: "easeOut" }}
          aria-hidden
        >
          <div
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ transform: "translate3d(0,0,0)" }}
          >
            {particles.map((p) => (
              <span
                key={p.id}
                className="tokio-seasonal-particle pointer-events-none absolute top-[-8%] block"
                style={
                  {
                    left: p.left,
                    width: p.size,
                    height: p.size,
                    color:
                      season === "sakura" && p.id % 3 === 0
                        ? "#FF69B4"
                        : season === "momiji" && p.id % 2 === 0
                          ? "#F29727"
                          : seasonColor(season),
                    opacity: p.opacity,
                    animationDelay: p.delay,
                    animationDuration: p.duration,
                    transform: "translate3d(0,0,0)",
                    WebkitTransform: "translate3d(0,0,0)",
                    willChange: "transform, opacity",
                    ["--tokio-drift" as string]: p.drift,
                    ["--tokio-spin" as string]: p.rotate,
                  } as CSSProperties
                }
              >
                <ParticleGlyph season={season} />
              </span>
            ))}
          </div>

          {badge ? (
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-[18%] z-[1] flex justify-center px-4"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <p className="pointer-events-none rounded-full border border-white/15 bg-[#0D1117]/80 px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-md sm:text-xs">
                <span className="mr-1.5" aria-hidden>
                  {seasonBadgeEmoji(season)}
                </span>
                {badge}
              </p>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
