"use client";

import dynamic from "next/dynamic";

/** Defer framer-motion seasonal FX off the critical path. */
const SeasonalParticlesHost = dynamic(
  () =>
    import("@/components/branding/SeasonalParticles").then((m) => ({
      default: m.SeasonalParticlesHost,
    })),
  { ssr: false }
);

export function LazySeasonalParticlesHost() {
  return <SeasonalParticlesHost />;
}
