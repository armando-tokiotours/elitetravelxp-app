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

/** Soft ambient flurry — denser field, organic timing. */
const PARTICLE_COUNT = 56;

/** Autumn maple palette — red / orange / yellow / brown. */
const MOMIJI_COLORS = [
  { fill: "#E11D48", stroke: "#7F1D1D", glow: "rgba(225, 29, 72, 0.22)" },
  { fill: "#EA580C", stroke: "#9A3412", glow: "rgba(234, 88, 12, 0.22)" },
  { fill: "#F6A724", stroke: "#A16207", glow: "rgba(246, 167, 36, 0.25)" },
  { fill: "#CA8A04", stroke: "#713F12", glow: "rgba(202, 138, 4, 0.22)" },
  { fill: "#B45309", stroke: "#78350F", glow: "rgba(180, 83, 9, 0.22)" },
  { fill: "#92400E", stroke: "#451A03", glow: "rgba(146, 64, 14, 0.2)" },
  { fill: "#DC2626", stroke: "#7F1D1D", glow: "rgba(220, 38, 38, 0.22)" },
] as const;

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
  /** Momiji color index; ignored for sakura/snow */
  colorIndex: number;
};

function buildParticles(
  token: number,
  season: Exclude<ParticleSeason, null>
): ParticleSpec[] {
  const seed = token * 9973;
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Two mixed primes so neighbors don't share the same delay/left band
    const n = (seed + i * 7919) % 10000;
    const m = (seed + i * 6571 + 433) % 10000;
    // Same organic scatter for sakura / snow / momiji
    const left = ((n * 37 + m * 13) % 1000) / 10;
    const delay = (m % 280) / 100;
    const duration = 4.4 + (n % 180) / 100;
    const size = 14 + (n % 15);
    const height = Math.round(size * (1.15 + (m % 20) / 100));
    const drift = ((m % 120) - 60) * 1.25;
    const opacity = 0.62 + (n % 35) / 100;
    const rotate = `${((n + m) % 360) - 180}deg`;
    // Color palette only for autumn leaves — sakura/snow ignore this
    const colorIndex =
      season === "momiji" ? (n + i * 3) % MOMIJI_COLORS.length : 0;
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
      colorIndex,
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

/** Autumn maple leaf — color varies (red / orange / yellow / brown). */
function MomijiLeafSvg({
  className,
  colorIndex = 0,
}: {
  className?: string;
  colorIndex?: number;
}) {
  const palette = MOMIJI_COLORS[colorIndex % MOMIJI_COLORS.length];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      style={{ filter: `drop-shadow(0px 2px 4px ${palette.glow})` }}
    >
      <path
        d="M12 3.2c.9 1.6 2.2 2.6 4.2 2.8-1.3.8-2.1 2-2.4 3.8 1.8-.2 3.4.2 4.8 1.4-1.6.7-2.7 1.8-3.3 3.4 1.2.1 2.4.6 3.4 1.5-1.8.3-3.1 1.1-4 2.5-.4-1.5-1.3-2.6-2.7-3.3-1.4.7-2.3 1.8-2.7 3.3-.9-1.4-2.2-2.2-4-2.5 1-.9 2.2-1.4 3.4-1.5-.6-1.6-1.7-2.7-3.3-3.4 1.4-1.2 3-1.6 4.8-1.4-.3-1.8-1.1-3-2.4-3.8 2-.2 3.3-1.2 4.2-2.8z"
        fill={palette.fill}
        fillOpacity="0.9"
      />
      <path
        d="M12 3.5v14.5"
        stroke={palette.stroke}
        strokeWidth="0.6"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ParticleGlyph({
  season,
  colorIndex = 0,
  iconUrl,
}: {
  season: Exclude<ParticleSeason, null>;
  colorIndex?: number;
  iconUrl?: string | null;
}) {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        className="pointer-events-none h-full w-full object-contain"
        draggable={false}
      />
    );
  }
  if (season === "sakura") {
    // Pink petals only — no autumn palette
    return <SakuraPetalSvg className="pointer-events-none h-full w-full" />;
  }
  if (season === "snow") {
    // Icy white/cyan only — no autumn palette
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
  return (
    <MomijiLeafSvg
      className="pointer-events-none h-full w-full"
      colorIndex={colorIndex}
    />
  );
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
  const iconUrl = useSeasonalFxStore((s) => s.iconUrl);
  const token = useSeasonalFxStore((s) => s.token);
  const clear = useSeasonalFxStore((s) => s.clear);

  // Ensure particle date rules are loaded even before builder config
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getPocketBase } = await import("@/lib/pocketbase/client");
        const {
          setSeasonalParticleRules,
          getSeasonalParticleRules,
          setSeasonalCharacterRules,
          getSeasonalCharacterRules,
        } = await import("@/lib/seasonality");
        if (getSeasonalParticleRules().length === 0) {
          const rows = await getPocketBase()
            .collection("seasonal_particles")
            .getFullList<import("@/lib/pocketbase/client").PbSeasonalParticle>({
              sort: "sort_order,start_month,start_day",
            });
          if (!cancelled) {
            setSeasonalParticleRules(
              rows.filter((r) => r.is_active !== false)
            );
          }
        }
        if (getSeasonalCharacterRules().length === 0) {
          const chars = await getPocketBase()
            .collection("seasonal_characters")
            .getFullList<import("@/lib/pocketbase/client").PbSeasonalCharacter>({
              sort: "sort_order,key",
            });
          if (!cancelled) {
            setSeasonalCharacterRules(
              chars.filter((r) => r.is_active !== false)
            );
          }
        }
      } catch {
        /* collection may not exist yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const particles = useMemo(
    () => (active && season ? buildParticles(token, season) : []),
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
                <ParticleGlyph
                  season={season}
                  colorIndex={p.colorIndex}
                  iconUrl={iconUrl}
                />
              </span>
            ))}
          </div>

          {badge ? (
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex justify-center px-5 pt-3.5 sm:pt-4"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <div className="flex w-full max-w-3xl items-center justify-start pl-[8.75rem] sm:pl-40">
                <p className="pointer-events-none max-w-[min(100%,14rem)] truncate rounded-full border border-white/15 bg-[#0D1117]/85 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-md sm:max-w-none sm:px-3.5 sm:text-[11px]">
                  <span className="mr-1.5" aria-hidden>
                    {seasonBadgeEmoji(season)}
                  </span>
                  {badge}
                </p>
              </div>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
