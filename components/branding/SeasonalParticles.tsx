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

/** Soft ambient flurry — slower drift, staggered start. */
const PARTICLE_COUNT = 48;

/** Wave delays so petals start in a gentle cascade, not all at once. */
const STAGGER_DELAYS_S = [0, 0.3, 0.7, 1.2] as const;

type ParticleSpec = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: string;
  height: string;
  drift: string;
  opacity: number;
  rotate: string;
};

function buildParticles(token: number): ParticleSpec[] {
  const seed = token * 9973;
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const n = (seed + i * 7919) % 10000;
    const left = (n % 1000) / 10;
    // Staggered wave + tiny jitter so the cascade feels organic
    const baseDelay = STAGGER_DELAYS_S[i % STAGGER_DELAYS_S.length];
    const delay = baseDelay + ((n % 20) / 100) * 0.25;
    // ~5s float; slight variance keeps the field from looking mechanical
    const duration = 4.85 + ((n % 40) / 100) * 0.5;
    // Soft petal sizes: ~16–25px wide, slightly taller for petal/leaf silhouette
    const size = 16 + (n % 10);
    const height = Math.round(size * 1.25);
    // Wider side-to-side sway for natural flutter (px)
    const drift = ((n % 80) - 40) * 1.15;
    const opacity = 0.7 + ((n % 25) / 100) * 0.25;
    const rotate = `${(n % 360) - 180}deg`;
    return {
      id: i,
      left: `${left}%`,
      delay: `${delay.toFixed(2)}s`,
      duration: `${duration.toFixed(2)}s`,
      size: `${size}px`,
      height: `${height}px`,
      drift: `${drift.toFixed(1)}px`,
      opacity,
      rotate,
    };
  });
}

/** Soft cherry-blossom petal — readable at 16–25px. */
function SakuraPetalSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      style={{ filter: "drop-shadow(0px 2px 4px rgba(230, 15, 67, 0.25))" }}
    >
      <path
        d="M12 2C10.5 5 6 8.5 6 13.5C6 17.5 8.5 21 12 22C15.5 21 18 17.5 18 13.5C18 8.5 13.5 5 12 2Z"
        fill="#FFB7C5"
        fillOpacity="0.9"
      />
      <path
        d="M12 2C11.2 6 8 9.5 8 13.5C8 16.5 9.8 19.5 12 20.5"
        stroke="#E60F43"
        strokeWidth="0.5"
        strokeOpacity="0.4"
      />
    </svg>
  );
}

/** Autumn maple leaf silhouette. */
function MomijiLeafSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      style={{ filter: "drop-shadow(0px 2px 4px rgba(225, 29, 72, 0.2))" }}
    >
      <path
        d="M12 3.2c.9 1.6 2.2 2.6 4.2 2.8-1.3.8-2.1 2-2.4 3.8 1.8-.2 3.4.2 4.8 1.4-1.6.7-2.7 1.8-3.3 3.4 1.2.1 2.4.6 3.4 1.5-1.8.3-3.1 1.1-4 2.5-.4-1.5-1.3-2.6-2.7-3.3-1.4.7-2.3 1.8-2.7 3.3-.9-1.4-2.2-2.2-4-2.5 1-.9 2.2-1.4 3.4-1.5-.6-1.6-1.7-2.7-3.3-3.4 1.4-1.2 3-1.6 4.8-1.4-.3-1.8-1.1-3-2.4-3.8 2-.2 3.3-1.2 4.2-2.8z"
        fill="#E11D48"
        fillOpacity="0.88"
      />
      <path
        d="M12 3.5v14.5"
        stroke="#7F1D1D"
        strokeWidth="0.6"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ParticleGlyph({
  season,
}: {
  season: Exclude<ParticleSeason, null>;
}) {
  if (season === "sakura") {
    return <SakuraPetalSvg className="pointer-events-none h-full w-full" />;
  }
  if (season === "snow") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none h-full w-full"
        aria-hidden
        style={{ filter: "drop-shadow(0px 1px 3px rgba(224, 247, 250, 0.35))" }}
      >
        <g
          fill="none"
          stroke="#E0F7FA"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.92"
        >
          <path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M2 12h20" />
        </g>
        <circle cx="12" cy="12" r="2" fill="#FFFFFF" opacity="0.9" />
      </svg>
    );
  }
  return <MomijiLeafSvg className="pointer-events-none h-full w-full" />;
}

function seasonBadgeEmoji(season: Exclude<ParticleSeason, null>): string {
  if (season === "sakura") return "🌸";
  if (season === "snow") return "❄️";
  return "🍁";
}

/**
 * Full-screen seasonal ambient particles — gentle ~5s drift (plus fade).
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
                    height: p.height,
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
