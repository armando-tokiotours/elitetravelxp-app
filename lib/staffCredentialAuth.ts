/**
 * Who may write staff_profiles / credential photos.
 *
 * Observed PocketBase rules (do NOT change live VPS collections from here):
 * - staff_profiles (1790370000): list/view/create/update/delete all
 *   `@request.auth.id != ''` — any authenticated actor can touch any profile
 *   row *if* the SDK call is allowed. File fields still need FormData.
 * - staff auth (1790340001): `manageRule: null`. Non-superusers may only
 *   update their *own* staff login (name, email, password). Owner/ops JWTs
 *   in the `staff` collection cannot `staff.update(otherId)` — that 403 is
 *   why Credential Booklet Save & close failed before profile/photo ran.
 * Superuser (`_superusers`) and owner/ops must edit others the same way
 * they assign agents: server-side admin client, not a fake `users` collection.
 */

import PocketBase from "pocketbase";
import {
  canAccessOpsBoard,
  canAccessTeamAccess,
  isStaffRole,
  type StaffRole,
} from "@/lib/staffRoles";

function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

function internalPbUrl(): string {
  return (
    envVal("POCKETBASE_INTERNAL_URL") ||
    envVal("POCKETBASE_URL") ||
    envVal("NEXT_PUBLIC_POCKETBASE_URL") ||
    "http://pocketbase:8090"
  );
}

export type CredentialActor = {
  email: string;
  staffId: string | null;
  isSuperuser: boolean;
  role: StaffRole | null;
};

export async function verifyCredentialActor(
  request: Request
): Promise<CredentialActor | null> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const verify = new PocketBase(internalPbUrl());
  verify.autoCancellation(false);
  verify.authStore.save(token, null);

  try {
    const authData = await verify.collection("staff").authRefresh();
    const rec = authData.record;
    const email = String(rec?.email || "").trim();
    if (!email) return null;
    const roleRaw = String(rec?.role || "").trim();
    return {
      email,
      staffId: String(rec?.id || "").trim() || null,
      isSuperuser: false,
      role: isStaffRole(roleRaw) ? roleRaw : null,
    };
  } catch {
    /* try break-glass superuser */
  }
  try {
    const authData = await verify.collection("_superusers").authRefresh();
    const email = String(authData.record?.email || "").trim();
    if (!email) return null;
    return {
      email,
      staffId: null,
      isSuperuser: true,
      role: "owner",
    };
  } catch {
    return null;
  }
}

/** Self, PocketBase superuser, or owner/ops (same bar as assign-to-booking). */
export function canEditStaffCredential(
  actor: CredentialActor,
  targetStaffId: string
): boolean {
  const target = String(targetStaffId || "").trim();
  if (!target) return false;
  if (actor.isSuperuser) return true;
  if (actor.staffId && actor.staffId === target) return true;
  return canAccessTeamAccess(actor.role) || canAccessOpsBoard(actor.role);
}
