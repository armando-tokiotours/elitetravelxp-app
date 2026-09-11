"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createPocketBase } from "@/lib/pocketbase/client";
import type PocketBase from "pocketbase";

interface TeamAuthState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getClient: () => PocketBase;
  hydrateAuth: () => void;
}

export const useTeamAuth = create<TeamAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      isAuthenticated: false,

      hydrateAuth: () => {
        const { token } = get();
        if (!token) return;
        const pb = createPocketBase();
        pb.authStore.save(token, null);
        set({ isAuthenticated: pb.authStore.isValid });
      },

      getClient: () => {
        const pb = createPocketBase();
        const { token } = get();
        if (token) pb.authStore.save(token, null);
        return pb;
      },

      login: async (email, password) => {
        const pb = createPocketBase();
        pb.authStore.clear();
        try {
          await pb.collection("_superusers").authWithPassword(email, password);
        } catch (e) {
          // Re-throw with URL context for the login form
          const err = e as Error & { message?: string };
          err.message = `${err.message || "Login failed"} (${pb.baseUrl})`;
          throw err;
        }
        set({
          token: pb.authStore.token,
          email,
          isAuthenticated: true,
        });
      },

      logout: () => {
        const pb = createPocketBase();
        pb.authStore.clear();
        set({ token: null, email: null, isAuthenticated: false });
      },
    }),
    {
      name: "elite-team-auth",
      partialize: (s) => ({ token: s.token, email: s.email }),
      skipHydration: true,
    }
  )
);
