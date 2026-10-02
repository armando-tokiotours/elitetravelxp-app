/**
 * Staff Google Workspace SSO — domain allowlist + helpers.
 */

export const STAFF_GOOGLE_SSO_DOMAINS = [
  "tokiotours.nl",
  "travelexperiencesgroup.com",
] as const;

export function isAuthorizedStaffEmail(email: string | null | undefined): boolean {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e.includes("@")) return false;
  const domain = e.split("@").pop() || "";
  return (STAFF_GOOGLE_SSO_DOMAINS as readonly string[]).includes(domain);
}

export function staffGoogleSsoDeniedMessage(): string {
  return "Access Denied: Only official @tokiotours.nl or @travelexperiencesgroup.com Google Workspace accounts can sign in.";
}
