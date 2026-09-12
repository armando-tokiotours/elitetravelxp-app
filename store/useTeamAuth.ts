"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getTeamPocketBase } from "@/lib/pocketbase/client";
import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

interface TeamAuthState {
  token: string | null;
  email: string | null;
  /** Superuser record needed so the SDK treats the session as admin. */
  record: RecordModel | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getClient: () => PocketBase;
  /** Re-apply persisted token onto the in-memory PB client; returns whether session is usable. */
  ensureAuth: () => boolean;
  hydrateAuth: () => Promise<void>;
}

export const useTeamAuth = create<TeamAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      record: null,
      isAuthenticated: false,

      ensureAuth: () => {
        const { token, record } = get();
        const pb = getTeamPocketBase();
        if (!token) {
          pb.authStore.clear();
          return false;
        }
        // Always re-apply — HMR / URL change recreates an empty BaseAuthStore
        pb.authStore.save(token, record);
        const ok = pb.authStore.isValid;
        if (!ok) {
          pb.authStore.clear();
          set({
            token: null,
            record: null,
            email: null,
            isAuthenticated: false,
          });
        } else if (!get().isAuthenticated) {
          set({ isAuthenticated: true });
        }
        return ok;
      },

      hydrateAuth: async () => {
        const { token, record } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }
        const pb = getTeamPocketBase();
        pb.authStore.save(token, record);
        if (!pb.authStore.isValid) {
          pb.authStore.clear();
          set({
            token: null,
            record: null,
            email: null,
            isAuthenticated: false,
          });
          return;
        }
        try {
          await pb.collection("_superusers").authRefresh();
          set({
            token: pb.authStore.token,
            record: pb.authStore.record,
            email: get().email,
            isAuthenticated: true,
          });
        } catch {
          // Keep session if JWT is still valid (PB briefly unreachable, etc.)
          if (pb.authStore.isValid) {
            set({ isAuthenticated: true });
            return;
          }
          pb.authStore.clear();
          set({
            token: null,
            record: null,
            email: null,
            isAuthenticated: false,
          });
        }
      },

      getClient: () => {
        get().ensureAuth();
        return getTeamPocketBase();
      },

      login: async (email, password) => {
        const pb = getTeamPocketBase();
        pb.authStore.clear();
        try {
          await pb.collection("_superusers").authWithPassword(email, password);
        } catch (e) {
          const err = e as Error & { message?: string };
          err.message = `${err.message || "Login failed"} (${pb.baseUrl})`;
          throw err;
        }
        set({
          token: pb.authStore.token,
          record: pb.authStore.record,
          email,
          isAuthenticated: true,
        });
      },

      logout: () => {
        const pb = getTeamPocketBase();
        pb.authStore.clear();
        set({
          token: null,
          record: null,
          email: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "elite-team-auth",
      partialize: (s) => ({
        token: s.token,
        email: s.email,
        record: s.record,
      }),
      skipHydration: true,
    }
  )
);
