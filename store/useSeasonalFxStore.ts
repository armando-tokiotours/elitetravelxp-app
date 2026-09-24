"use client";

import { create } from "zustand";
import {
  particleSeasonFromDate,
  particleSeasonFromMonthLabel,
  seasonalParticleMeta,
  type ParticleSeason,
} from "@/lib/seasonality";

type SeasonalFxState = {
  active: boolean;
  season: Exclude<ParticleSeason, null> | null;
  badge: string | null;
  /** Monotonic token so rapid re-triggers remount the overlay. */
  token: number;
  triggerFromDate: (input: string | Date | null | undefined) => void;
  triggerFromMonthLabel: (label: string | null | undefined) => void;
  triggerSeason: (season: ParticleSeason) => void;
  clear: () => void;
};

/** Full opacity burst before fade begins. */
const VISIBLE_MS = 2500;
/** Smooth dissolve before unmount. */
export const SEASONAL_FX_FADE_MS = 500;
/** Total on-screen lifetime including fade. */
export const SEASONAL_FX_DURATION_MS = VISIBLE_MS + SEASONAL_FX_FADE_MS;

export const useSeasonalFxStore = create<SeasonalFxState>((set, get) => ({
  active: false,
  season: null,
  badge: null,
  token: 0,
  triggerFromDate: (input) => {
    get().triggerSeason(particleSeasonFromDate(input));
  },
  triggerFromMonthLabel: (label) => {
    get().triggerSeason(particleSeasonFromMonthLabel(label));
  },
  triggerSeason: (season) => {
    const meta = seasonalParticleMeta(season);
    if (!meta) return;
    set((s) => ({
      active: true,
      season: meta.season,
      badge: meta.badge,
      token: s.token + 1,
    }));
    // Clear after visible window; host fades out over SEASONAL_FX_FADE_MS
    window.setTimeout(() => {
      const cur = get();
      if (cur.season === meta.season && cur.active) get().clear();
    }, VISIBLE_MS);
  },
  clear: () => set({ active: false, season: null, badge: null }),
}));
