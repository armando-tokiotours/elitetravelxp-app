/**
 * Staff roles — view/access helpers for Silo 3 portals.
 *
 * Pipeline hierarchy (Ops → Concierge → Vendors):
 *   owner / ops  ≈ ADMIN_OPS     — full system + assign concierge
 *   agent        ≈ CONCIERGE     — client hub, vendor dispatch, inspector
 *   guide        ≈ GUIDE         — assigned tours only
 *   driver       ≈ DRIVER        — assigned transport only
 *   ticketer     ≈ TICKET_SUPPLIER — ticket lines only
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
      return "/ops";
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

/** Ops inbox + booking inspector (Ops managers + Concierge agents). */
export function canAccessOpsBoard(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "ops" || role === "agent";
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

/** Vendors never see financials / margin in their portals. */
export function isVendorRole(role: StaffRole | null | undefined): boolean {
  return role === "guide" || role === "driver" || role === "ticketer";
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner (Admin Ops)",
  ops: "Operations manager",
  agent: "Concierge agent",
  ticketer: "Ticket supplier",
  guide: "Guide",
  driver: "Driver Coordinator",
  agency: "Agency",
};

/** Credential registry filter tabs (Drivers = Driver Coordinator role). */
export const CREDENTIAL_TABS = [
  { id: "agencies", label: "Agencies" },
  { id: "guides", label: "Guides" },
  { id: "staff", label: "Staff" },
  { id: "drivers", label: "Drivers" },
] as const;

export type CredentialTab = (typeof CREDENTIAL_TABS)[number]["id"];

export function roleMatchesCredentialTab(
  role: StaffRole | null | undefined,
  tab: CredentialTab
): boolean {
  switch (tab) {
    case "agencies":
      return role === "agency";
    case "guides":
      return role === "guide";
    case "drivers":
      return role === "driver";
    case "staff":
      return (
        role === "owner" ||
        role === "ops" ||
        role === "agent" ||
        role === "ticketer" ||
        !role
      );
    default:
      return true;
  }
}
