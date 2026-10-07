"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getTeamPocketBase } from "@/lib/pocketbase/client";
import {
  homePathForRole,
  isStaffRole,
  type StaffRole,
} from "@/lib/staffRoles";
import { resolveStaffRoleForEmail } from "@/lib/staffRoleProvisioning";
import {
  isAuthorizedStaffEmail,
  staffGoogleSsoDeniedMessage,
} from "@/lib/staffGoogleAuth";
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
  /** Google Workspace SSO via PocketBase staff.oauth2 (google provider). */
  loginWithGoogle: () => Promise<{ role: StaffRole }>;
  /** @deprecated use loginWithGoogle */
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
          "Use Sign in with Google Workspace. If it fails, ensure GOOGLE_CLIENT_ID/SECRET are set on PocketBase and redirect URI is registered."
        );
      },

      loginWithGoogle: async () => {
        const pb = getTeamPocketBase();
        pb.authStore.clear();

        let authData: {
          record?: RecordModel | null;
          meta?: { email?: string; name?: string };
          token?: string;
        };
        try {
          authData = (await pb.collection("staff").authWithOAuth2({
            provider: "google",
            // role is required on staff — OAuth create fails without createData
            createData: {
              role: "agent",
              account_type: "STAFF",
              active: true,
            },
          })) as typeof authData;
        } catch (err) {
          const anyErr = err as {
            message?: string;
            status?: number;
            response?: { message?: string; data?: unknown };
          };
          const msg = String(
            anyErr?.response?.message || anyErr?.message || err || ""
          );
          const detail = anyErr?.response?.data
            ? ` ${JSON.stringify(anyErr.response.data)}`
            : "";
          if (/provider|not enabled|oauth2|404/i.test(msg) && anyErr?.status === 404) {
            throw new Error(
              "Google Workspace SSO is not configured on PocketBase yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the PocketBase process and restart it. Also add redirect URI: {PB_URL}/api/oauth2-redirect"
            );
          }
          if (/create|failed to create|403|Only superusers|role/i.test(msg + detail)) {
            throw new Error(
              `Google sign-in could not create your staff account (${msg}).${detail}`
            );
          }
          throw new Error(
            msg
              ? `Google Workspace authentication failed: ${msg}${detail}`
              : "Google Workspace authentication failed."
          );
        }

        const record = authData.record || pb.authStore.record;
        const email = String(
          record?.email || authData.meta?.email || ""
        )
          .trim()
          .toLowerCase();

        if (!email) {
          pb.authStore.clear();
          clearAuth(set);
          throw new Error("Google did not return an email address.");
        }

        if (!isAuthorizedStaffEmail(email)) {
          pb.authStore.clear();
          clearAuth(set);
          throw new Error(staffGoogleSsoDeniedMessage());
        }

        if (record && record.active === false) {
          pb.authStore.clear();
          clearAuth(set);
          throw new Error("This staff account is inactive.");
        }

        // Soft role sync: core team locked; others keep Admin / invite role
        const preferred = resolveStaffRoleForEmail(email, {
          currentRole: String(record?.role || ""),
          accountType: String(
            (record as { account_type?: string } | null | undefined)
              ?.account_type || ""
          ),
        });
        if (record?.id && String(record.role || "") !== preferred) {
          try {
            await pb.collection("staff").update(record.id, { role: preferred });
            record.role = preferred;
          } catch {
            /* non-blocking if rules deny self-update */
          }
        }

        const collection: AuthCollection = "staff";
        const role = roleFromRecord(collection, record);
        set({
          token: pb.authStore.token,
          record,
          email,
          role,
          authCollection: collection,
          staffId: String(record?.id || "") || null,
          agencyId: String(record?.agency_id || "") || null,
          isAuthenticated: true,
        });
        return { role };
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
          // Stale JWT (e.g. production) still looks valid client-side but fails
          // against the current PB URL — never keep that session.
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
