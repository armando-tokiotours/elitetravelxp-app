/**
 * Staff roles — view/access helpers for Silo 3 portals.
 *
 * ops = Operations manager (all ops visibility + assign)
 * agent = Concierge agent (face-to-client for direct / non-agency bookings)
 */

export const STAFF_ROLES = [
  "owner",
  "ops",
  "agent",
  "ticketer",
  "guide",
  "driver",
  "agency",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

/** Home path after login by role. */
export function homePathForRole(role: StaffRole | null | undefined): string {
  switch (role) {
    case "owner":
    case "ops":
      return "/ops";
    case "agent":
      return "/agent";
    case "ticketer":
      return "/ticketer";
    case "guide":
      return "/guide";
    case "driver":
      return "/driver";
    case "agency":
      return "/agency";
    default:
      return "/team-access";
  }
}

export function canAccessTeamAccess(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops";
}

export function canAccessAdmin(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops";
}

export function canAccessOpsBoard(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops";
}

export function canAccessMoney(role: StaffRole | null | undefined): boolean {
  return role === "owner";
}

export function canAccessAgent(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "agent";
}

export function canAccessTicketer(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "ticketer";
}

export function canAccessGuide(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "guide";
}

export function canAccessDriver(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "driver";
}

export function canAccessAgency(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "agency";
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  ops: "Operations manager",
  agent: "Concierge agent",
  ticketer: "Ticketer",
  guide: "Guide",
  driver: "Driver",
  agency: "Agency",
};
