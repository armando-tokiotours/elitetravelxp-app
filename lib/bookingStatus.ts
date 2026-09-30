/**
 * Canonical booking lifecycle shared by Builder, Bookings & Leads, Ops, Pass.
 *
 * draft → incoming → quoted → confirmed → in_ops → done | cancelled
 */

export const CANONICAL_STATUSES = [
  "draft",
  "incoming",
  "quoted",
  "confirmed",
  "in_ops",
  "done",
  "cancelled",
] as const;

export type CanonicalBookingStatus = (typeof CANONICAL_STATUSES)[number];

export type OpsHubStatus = CanonicalBookingStatus;

/** Normalize any legacy / silo-specific status into the canonical set. */
export function toCanonicalStatus(raw: unknown): CanonicalBookingStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "done" || s === "completed") return "done";
  if (s === "in_ops" || s === "ops") return "in_ops";
  if (s === "confirmed" || s === "contacted") return "confirmed";
  if (s === "quoted") return "quoted";
  if (
    s === "incoming" ||
    s === "in_progress" ||
    s === "requested" ||
    s === "deposit_paid" ||
    s === "pending_deposit" ||
    s === "paid"
  ) {
    return "incoming";
  }
  if (s === "draft" || s === "lead" || s === "pre_qualification") return "draft";
  if ((CANONICAL_STATUSES as readonly string[]).includes(s)) {
    return s as CanonicalBookingStatus;
  }
  return "draft";
}

/** Map canonical → bookings_and_leads select (keeps lead as draft alias in DB). */
export function toBookingsAndLeadsStatus(
  status: CanonicalBookingStatus | string
): string {
  const c = toCanonicalStatus(status);
  if (c === "draft") return "draft";
  if (c === "incoming") return "in_progress";
  if (c === "done") return "confirmed";
  return c;
}

/** Map canonical / lead status → ops_hub board. */
export function mapLeadStatusToOpsHub(
  status?: string | null
): CanonicalBookingStatus {
  return toCanonicalStatus(status);
}

/** Guest builder store still uses draft | in_progress | confirmed. */
export function toBuilderBookingStatus(
  status: CanonicalBookingStatus | string
): "draft" | "in_progress" | "confirmed" {
  const c = toCanonicalStatus(status);
  if (c === "confirmed" || c === "in_ops" || c === "done") return "confirmed";
  if (c === "draft") return "draft";
  return "in_progress";
}

export type PassStatusLabel =
  | "DRAFT"
  | "INCOMING"
  | "QUOTED"
  | "CONFIRMED"
  | "IN_OPS"
  | "DONE"
  | "CANCELLED"
  | "IN_PROGRESS"
  | "REVIEW";

export function toPassStatusLabel(
  status: CanonicalBookingStatus | string
): PassStatusLabel {
  const c = toCanonicalStatus(status);
  switch (c) {
    case "draft":
      return "DRAFT";
    case "incoming":
      return "INCOMING";
    case "quoted":
      return "QUOTED";
    case "confirmed":
      return "CONFIRMED";
    case "in_ops":
      return "IN_OPS";
    case "done":
      return "DONE";
    case "cancelled":
      return "CANCELLED";
    default:
      return "DRAFT";
  }
}

export function canonicalStatusLabel(status?: string | null): string {
  return toCanonicalStatus(status).replace(/_/g, " ");
}
