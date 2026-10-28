/**
 * Editable email templates for Payment Confirmation Dispatch (30% / 100%).
 * Reuses the systemMessages localStorage override pattern — no new PB collection.
 * Server sends use catalog defaults (browser overrides are Team Access preview only).
 */

import {
  getSystemMessage,
  type SystemMessageKey,
} from "@/lib/systemMessages";

export type PaymentDispatchThreshold = "deposit_30" | "full_100";

export type PaymentDispatchTemplateId =
  | "dispatch_guide_lock_30"
  | "dispatch_guide_lock_100"
  | "dispatch_driver_lock_30"
  | "dispatch_driver_lock_100";

/** Subject + body pairs stored as system message keys. */
export const PAYMENT_DISPATCH_TEMPLATE_KEYS: Record<
  PaymentDispatchTemplateId,
  { subjectKey: SystemMessageKey; bodyKey: SystemMessageKey }
> = {
  dispatch_guide_lock_30: {
    subjectKey: "dispatch_guide_lock_30_subject",
    bodyKey: "dispatch_guide_lock_30_body",
  },
  dispatch_guide_lock_100: {
    subjectKey: "dispatch_guide_lock_100_subject",
    bodyKey: "dispatch_guide_lock_100_body",
  },
  dispatch_driver_lock_30: {
    subjectKey: "dispatch_driver_lock_30_subject",
    bodyKey: "dispatch_driver_lock_30_body",
  },
  dispatch_driver_lock_100: {
    subjectKey: "dispatch_driver_lock_100_subject",
    bodyKey: "dispatch_driver_lock_100_body",
  },
};

export type PaymentDispatchTemplateVars = {
  pnr: string;
  guestName?: string | null;
  tourDate?: string | null;
  assigneeName?: string | null;
  thresholdLabel: string;
};

function applyVars(text: string, vars: PaymentDispatchTemplateVars): string {
  const guest = String(vars.guestName || "").trim() || "Guest";
  const assignee = String(vars.assigneeName || "").trim() || "Team";
  const date = String(vars.tourDate || "").slice(0, 10) || "TBD";
  return text
    .replaceAll("{{pnr}}", vars.pnr)
    .replaceAll("{{guestName}}", guest)
    .replaceAll("{{assigneeName}}", assignee)
    .replaceAll("{{tourDate}}", date)
    .replaceAll("{{thresholdLabel}}", vars.thresholdLabel);
}

export function resolvePaymentDispatchTemplate(
  id: PaymentDispatchTemplateId,
  vars: PaymentDispatchTemplateVars
): { subject: string; text: string; html: string } {
  const keys = PAYMENT_DISPATCH_TEMPLATE_KEYS[id];
  const subject = applyVars(getSystemMessage(keys.subjectKey), vars);
  const text = applyVars(getSystemMessage(keys.bodyKey), vars);
  const html = `<p>${text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, "<br/>"))
    .join("</p><p>")}</p>`;
  return { subject, text, html };
}

export function templateIdFor(
  role: "guide" | "driver",
  threshold: PaymentDispatchThreshold
): PaymentDispatchTemplateId {
  if (role === "guide") {
    return threshold === "full_100"
      ? "dispatch_guide_lock_100"
      : "dispatch_guide_lock_30";
  }
  return threshold === "full_100"
    ? "dispatch_driver_lock_100"
    : "dispatch_driver_lock_30";
}
