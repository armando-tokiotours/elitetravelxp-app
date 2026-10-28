/**
 * Staff roles — view/access helpers for Silo 3 portals.
 *
 * Pipeline hierarchy (Ops → Concierge → Vendors):
 *   owner / ops  ≈ ADMIN_OPS     — full system + assign concierge
 *   agent        ≈ CONCIERGE     — client hub, vendor dispatch, inspector
 *   accounting   ≈ ACCOUNTANT    — settlements desk (not full Ops suite)
 *   guide        ≈ GUIDE         — assigned tours only
 *   driver       ≈ DRIVER        — assigned transport only
 *   ticketer     ≈ TICKET_SUPPLIER — ticket lines only
 */

export const STAFF_ROLES = [
  "owner",
  "ops",
  "agent",
  "accounting",
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
    case "accounting":
      return "/accounting/dashboard";
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

/** Accountant Financial Settlements Desk (+ Owner oversight). */
export function canAccessAccounting(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "accounting";
}

/** Money / payouts / agency invoice surfaces (not the full Ops suite). */
export function canAccessMoney(role: StaffRole | null | undefined): boolean {
  return role === "owner" || role === "accounting";
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
  owner: "Owner (Super User)",
  ops: "Ops Coordinator",
  agent: "Concierge agent",
  accounting: "Accountant",
  ticketer: "Ticket supplier",
  guide: "Guide",
  driver: "Driver Coordinator",
  agency: "Agency",
};

/** Roles that can be assigned as booking in-charge (concierge dropdown). */
export const CONCIERGE_ASSIGNABLE_ROLES = ["owner", "ops", "agent"] as const;

export type ConciergeAssignableRole =
  (typeof CONCIERGE_ASSIGNABLE_ROLES)[number];

/** Short option labels: Super User / Ops / Agent. */
export function conciergeAssigneeRoleLabel(
  role: string | null | undefined
): string {
  switch (role) {
    case "owner":
      return "Super User";
    case "ops":
      return "Ops";
    case "agent":
      return "Agent";
    default:
      if (role && isStaffRole(role)) return ROLE_LABELS[role];
      return String(role || "").trim();
  }
}

export function isConciergeAssignableRole(
  role: string | null | undefined
): role is ConciergeAssignableRole {
  return (
    role === "owner" || role === "ops" || role === "agent"
  );
}

/** Credential registry filter tabs (Drivers = Driver Coordinator role). */
export const CREDENTIAL_TABS = [
  { id: "agencies", label: "Agencies" },
  { id: "guides", label: "Guides" },
  { id: "drivers", label: "Drivers" },
  { id: "ticketers", label: "Ticketers" },
  { id: "staff", label: "Staff" },
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
    case "ticketers":
      return role === "ticketer";
    case "staff":
      return (
        role === "owner" ||
        role === "ops" ||
        role === "agent" ||
        role === "accounting" ||
        !role
      );
    default:
      return true;
  }
}
