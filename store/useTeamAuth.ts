"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getTeamPocketBase } from "@/lib/pocketbase/client";
import {
  homePathForRole,
  isStaffRole,
  type StaffRole,
} from "@/lib/staffRoles";
import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

export type AuthCollection = "staff" | "_superusers";

interface TeamAuthState {
  token: string | null;
  email: string | null;
  /** Auth record (staff or superuser). */
  record: RecordModel | null;
  role: StaffRole | null;
  authCollection: AuthCollection | null;
  staffId: string | null;
  agencyId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ role: StaffRole }>;
  /** Stub until Google OAuth Client ID/Secret is configured in PocketBase. */
  loginWithGoogleStub: () => never;
  logout: () => void;
  getClient: () => PocketBase;
  ensureAuth: () => boolean;
  hydrateAuth: () => Promise<void>;
  homePath: () => string;
}

function roleFromRecord(
  collection: AuthCollection,
  record: RecordModel | null
): StaffRole {
  if (collection === "_superusers") return "owner";
  const r = record?.role;
  return isStaffRole(r) ? r : "ops";
}

function clearAuth(set: (partial: Partial<TeamAuthState>) => void) {
  set({
    token: null,
    record: null,
    email: null,
    role: null,
    authCollection: null,
    staffId: null,
    agencyId: null,
    isAuthenticated: false,
  });
}

export const useTeamAuth = create<TeamAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      record: null,
      role: null,
      authCollection: null,
      staffId: null,
      agencyId: null,
      isAuthenticated: false,

      homePath: () => homePathForRole(get().role),

      loginWithGoogleStub: () => {
        throw new Error(
          "Google sign-in is not enabled yet. Add a Google OAuth Client ID/Secret in PocketBase → staff → OAuth2, then we can turn this on."
        );
      },

      ensureAuth: () => {
        const { token, record } = get();
        const pb = getTeamPocketBase();
        if (!token) {
          pb.authStore.clear();
          return false;
        }
        pb.authStore.save(token, record);
        const ok = pb.authStore.isValid;
        if (!ok) {
          pb.authStore.clear();
          clearAuth(set);
        } else if (!get().isAuthenticated) {
          set({ isAuthenticated: true });
        }
        return ok;
      },

      hydrateAuth: async () => {
        const { token, record, authCollection } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }
        const pb = getTeamPocketBase();
        pb.authStore.save(token, record);
        if (!pb.authStore.isValid) {
          pb.authStore.clear();
          clearAuth(set);
          return;
        }

        const collection: AuthCollection =
          authCollection === "staff" ? "staff" : "_superusers";

        try {
          await pb.collection(collection).authRefresh();
          const nextRecord = pb.authStore.record;
          const role = roleFromRecord(collection, nextRecord);
          set({
            token: pb.authStore.token,
            record: nextRecord,
            email: get().email || String(nextRecord?.email || ""),
            role,
            authCollection: collection,
            staffId: collection === "staff" ? String(nextRecord?.id || "") : null,
            agencyId:
              collection === "staff"
                ? String(nextRecord?.agency_id || "") || null
                : null,
            isAuthenticated: true,
          });
        } catch {
          if (pb.authStore.isValid) {
            const role = roleFromRecord(collection, pb.authStore.record);
            set({
              isAuthenticated: true,
              role,
              authCollection: collection,
            });
            return;
          }
          pb.authStore.clear();
          clearAuth(set);
        }
      },

      getClient: () => {
        get().ensureAuth();
        return getTeamPocketBase();
      },

      login: async (email, password) => {
        const pb = getTeamPocketBase();
        pb.authStore.clear();
        const trimmed = email.trim().toLowerCase();

        // Prefer staff collection; fall back to PocketBase superuser (break-glass owner).
        let collection: AuthCollection = "staff";
        try {
          await pb.collection("staff").authWithPassword(trimmed, password);
          const rec = pb.authStore.record;
          if (rec && rec.active === false) {
            pb.authStore.clear();
            throw new Error("This staff account is inactive.");
          }
        } catch (staffErr) {
          try {
            await pb
              .collection("_superusers")
              .authWithPassword(trimmed, password);
            collection = "_superusers";
          } catch {
            const err = staffErr as Error & { message?: string };
            err.message = `${err.message || "Login failed"} (${pb.baseUrl})`;
            throw err;
          }
        }

        const record = pb.authStore.record;
        const role = roleFromRecord(collection, record);
        set({
          token: pb.authStore.token,
          record,
          email: trimmed,
          role,
          authCollection: collection,
          staffId: collection === "staff" ? String(record?.id || "") : null,
          agencyId:
            collection === "staff"
              ? String(record?.agency_id || "") || null
              : null,
          isAuthenticated: true,
        });
        return { role };
      },

      logout: () => {
        const pb = getTeamPocketBase();
        pb.authStore.clear();
        clearAuth(set);
      },
    }),
    {
      name: "elite-team-auth",
      partialize: (s) => ({
        token: s.token,
        email: s.email,
        record: s.record,
        role: s.role,
        authCollection: s.authCollection,
        staffId: s.staffId,
        agencyId: s.agencyId,
      }),
      skipHydration: true,
    }
  )
);
