/**
 * Contractor / partner account provisioning helpers.
 * Auth collection is `staff` (not `users`).
 */

import { randomBytes } from "crypto";
import {
  homePathForRole,
  isStaffRole,
  ROLE_LABELS,
  type StaffRole,
} from "@/lib/staffRoles";

/** Roles that sign in with email + password (not Google Workspace SSO). */
export const CONTRACTOR_ROLES = [
  "guide",
  "driver",
  "agency",
  "ticketer",
] as const;

export type ContractorRole = (typeof CONTRACTOR_ROLES)[number];

export function isContractorRole(role: unknown): role is ContractorRole {
  return (
    typeof role === "string" &&
    (CONTRACTOR_ROLES as readonly string[]).includes(role)
  );
}

export function roleUsesPasswordLogin(role: StaffRole | null | undefined): boolean {
  return isContractorRole(role);
}

export function accountTypeForRole(role: StaffRole): string {
  if (role === "guide") return "GUIDE";
  if (role === "agency") return "TRAVEL_AGENT";
  return "STAFF";
}

/** Cryptographically strong temp password (PB min 8; includes upper/lower/digit/symbol). */
export function generateTempPassword(): string {
  const raw = randomBytes(18).toString("base64url");
  return `Tmp-${raw.slice(0, 14)}!a1`;
}

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function loginUrlForRole(role: StaffRole): string {
  switch (role) {
    case "guide":
      return `${siteOrigin()}/guide/login`;
    case "driver":
      return `${siteOrigin()}/driver/login`;
    case "agency":
      return `${siteOrigin()}/agency`;
    case "ticketer":
      return `${siteOrigin()}/ticketer`;
    default:
      return `${siteOrigin()}${homePathForRole(role)}`;
  }
}

export function buildContractorWelcomeMail(input: {
  name: string;
  email: string;
  role: StaffRole;
  tempPassword: string;
}): { subject: string; text: string; html: string } {
  const roleLabel = isStaffRole(input.role)
    ? ROLE_LABELS[input.role]
    : String(input.role);
  const loginUrl = loginUrlForRole(input.role);
  const displayName = input.name.trim() || "Partner";
  const subject = `Welcome to TokioTours — your ${roleLabel} login`;
  const text = [
    `Hi ${displayName},`,
    "",
    `Your TokioTours ${roleLabel} account is ready.`,
    "",
    `Login: ${loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.tempPassword}`,
    "",
    "On first sign-in you will be asked to set a new password before opening your portal.",
    "",
    "— TokioTours Ops",
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <p>Hi ${escapeHtml(displayName)},</p>
      <p>Your TokioTours <strong>${escapeHtml(roleLabel)}</strong> account is ready.</p>
      <p>
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#075473;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">
          Open login
        </a>
      </p>
      <p style="margin:16px 0 4px;font-size:13px;color:#555">Email</p>
      <p style="margin:0;font-family:ui-monospace,monospace">${escapeHtml(input.email)}</p>
      <p style="margin:16px 0 4px;font-size:13px;color:#555">Temporary password</p>
      <p style="margin:0;font-family:ui-monospace,monospace">${escapeHtml(input.tempPassword)}</p>
      <p style="margin-top:20px;font-size:13px;color:#444">
        On first sign-in you will be asked to set a new password before opening your portal.
      </p>
      <p style="margin-top:24px;font-size:12px;color:#888">— TokioTours Ops</p>
    </div>
  `.trim();
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function staffNeedsPasswordChange(
  record: unknown
): boolean {
  if (!record || typeof record !== "object") return false;
  return (
    (record as { force_password_change?: unknown }).force_password_change ===
    true
  );
}
