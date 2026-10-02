/**
 * Flexible staff / guide / travel-agent role helpers.
 * PocketBase collection is `staff` (not `users`).
 */

import type { StaffRole } from "@/lib/staffRoles";
import { isStaffRole } from "@/lib/staffRoles";

export type StaffAccountType = "STAFF" | "GUIDE" | "TRAVEL_AGENT" | "PENDING";

/** Core leadership — Google Workspace SSO preferred. */
export const CORE_STAFF_EMAIL_ROLE_MAP: Record<string, StaffRole> = {
  "armando@tokiotours.nl": "owner",
  "management@tokiotours.nl": "owner",
  "ivonne@tokiotours.nl": "accounting",
  "melissa@tokiotours.nl": "ops",
  "vip@tokiotours.nl": "agent",
};

export function isCoreTeamEmail(email: string | null | undefined): boolean {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  return Boolean(e && CORE_STAFF_EMAIL_ROLE_MAP[e]);
}

/**
 * Resolve role for provisioning / soft sync.
 * Never rejects — always returns a valid StaffRole.
 */
export function resolveStaffRoleForEmail(
  email: string | null | undefined,
  opts?: {
    currentRole?: string | null;
    accountType?: string | null;
  }
): StaffRole {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  if (e && CORE_STAFF_EMAIL_ROLE_MAP[e]) return CORE_STAFF_EMAIL_ROLE_MAP[e];

  const accountType = String(opts?.accountType || "")
    .trim()
    .toUpperCase();
  if (accountType === "GUIDE") return "guide";
  if (accountType === "TRAVEL_AGENT" || accountType === "AGENCY") return "agency";

  if (isStaffRole(opts?.currentRole)) return opts!.currentRole as StaffRole;

  if (
    e.endsWith("@tokiotours.nl") ||
    e.endsWith("@travelexperiencesgroup.com")
  ) {
    return "agent";
  }

  // External without type — treat as concierge default (Ops can flip to guide/agency)
  return "agent";
}

/** @deprecated alias — prefer CORE_STAFF_EMAIL_ROLE_MAP */
export const STAFF_EMAIL_ROLE_MAP = CORE_STAFF_EMAIL_ROLE_MAP;
