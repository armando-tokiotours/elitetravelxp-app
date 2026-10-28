import { create } from "zustand";

export type CurtainPhase = "idle" | "covering" | "awaiting-route";

type CurtainState = {
  /** Route the curtain should navigate to once it fully covers the screen. */
  pendingRoute: string | null;
  phase: CurtainPhase;
  request: (route: string) => void;
  setPhase: (phase: CurtainPhase) => void;
  clear: () => void;
};

/**
 * Tiny trigger store for the pink curtain wipe (landing selector → quiz).
 * The persistent <CurtainWipe /> overlay owns the animation/navigation
 * timing; this store only carries intent + phase across the route change,
 * so no React state has to be seeded from an effect in the overlay.
 */
export const useCurtainStore = create<CurtainState>((set, get) => ({
  pendingRoute: null,
  phase: "idle",
  request: (route) => {
    const trimmed = route?.trim();
    if (!trimmed || get().pendingRoute) return;
    set({ pendingRoute: trimmed, phase: "covering" });
  },
  setPhase: (phase) => set({ phase }),
  clear: () => set({ pendingRoute: null, phase: "idle" }),
}));
