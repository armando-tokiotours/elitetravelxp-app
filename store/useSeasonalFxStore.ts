"use client";

import { create } from "zustand";
import {
  particleSeasonFromMonthLabel,
  resolveParticleMetaFromInput,
  seasonalParticleMeta,
  type ParticleSeason,
} from "@/lib/seasonality";

type SeasonalFxState = {
  active: boolean;
  season: Exclude<ParticleSeason, null> | null;
  badge: string | null;
  iconUrl: string | null;
  /** Monotonic token so rapid re-triggers remount the overlay. */
  token: number;
  triggerFromDate: (input: string | Date | null | undefined) => void;
  triggerFromMonthLabel: (label: string | null | undefined) => void;
  triggerSeason: (
    season: ParticleSeason,
    opts?: { badge?: string; iconUrl?: string | null }
  ) => void;
  clear: () => void;
};

/** Visible window: ~5s fall + stagger before fade begins. */
const VISIBLE_MS = 6500;
/** Smooth dissolve before unmount. */
export const SEASONAL_FX_FADE_MS = 600;
/** Total on-screen lifetime including fade. */
export const SEASONAL_FX_DURATION_MS = VISIBLE_MS + SEASONAL_FX_FADE_MS;

export const useSeasonalFxStore = create<SeasonalFxState>((set, get) => ({
  active: false,
  season: null,
  badge: null,
  iconUrl: null,
  token: 0,
  triggerFromDate: (input) => {
    const meta = resolveParticleMetaFromInput(input);
    if (!meta) return;
    get().triggerSeason(meta.season, {
      badge: meta.badge,
      iconUrl: meta.iconUrl,
    });
  },
  triggerFromMonthLabel: (label) => {
    get().triggerSeason(particleSeasonFromMonthLabel(label));
  },
  triggerSeason: (season, opts) => {
    const fallback = seasonalParticleMeta(season);
    if (!fallback && !opts?.badge) return;
    if (!season) return;
    const badge = opts?.badge?.trim() || fallback?.badge || season;
    const iconUrl = opts?.iconUrl ?? null;
    set((s) => ({
      active: true,
      season,
      badge,
      iconUrl,
      token: s.token + 1,
    }));
    window.setTimeout(() => {
      const cur = get();
      if (cur.season === season && cur.active) get().clear();
    }, VISIBLE_MS);
  },
  clear: () =>
    set({ active: false, season: null, badge: null, iconUrl: null }),
}));
