/**
 * Canonical booking lifecycle shared by Builder, Bookings & Leads, Ops, Pass.
 *
 * Board columns (lowercase): draft → incoming → quoted → confirmed → in_ops → done | cancelled
 *
 * Unified PocketBase payment-aligned status (uppercase) keeps Guest + Ops copy in sync:
 * DRAFT → PENDING_DEPOSIT → PROCESSING → DEPOSIT_PAID → PENDING_BALANCE → FULLY_PAID
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

/** Strict PocketBase unified status values (uppercase). */
export const UNIFIED_PB_STATUSES = [
  "DRAFT",
  "PENDING_DEPOSIT",
  "PROCESSING",
  "DEPOSIT_PAID",
  "PENDING_BALANCE",
  "FULLY_PAID",
  "CANCELLED",
] as const;

export type UnifiedPbStatus = (typeof UNIFIED_PB_STATUSES)[number];

/** Normalize any legacy / silo-specific status into the canonical set. */
export function toCanonicalStatus(raw: unknown): CanonicalBookingStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "fully_paid" || s === "done" || s === "completed") return "done";
  if (s === "pending_balance" || s === "in_ops" || s === "ops") {
    return "in_ops";
  }
  if (s === "confirmed" || s === "contacted") return "confirmed";
  if (s === "quoted" || s === "processing" || s === "deposit_paid") {
    return "quoted";
  }
  if (
    s === "incoming" ||
    s === "in_progress" ||
    s === "requested" ||
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

/**
 * Resolve unified PB status from raw status + payment signals.
 * Prefer explicit unified strings; otherwise derive from legacy canonical + fees.
 */
export function toUnifiedPbStatus(
  raw: unknown,
  opts?: {
    depositPaidEur?: number | null;
    hasPaidFull?: boolean | null;
    processing?: boolean | null;
  }
): UnifiedPbStatus {
  const upper = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if ((UNIFIED_PB_STATUSES as readonly string[]).includes(upper)) {
    return upper as UnifiedPbStatus;
  }
  if (upper === "CANCELED") return "CANCELLED";

  if (opts?.processing) return "PROCESSING";
  if (opts?.hasPaidFull) return "FULLY_PAID";

  const depositPaid =
    Number(opts?.depositPaidEur) > 0 ||
    upper === "QUOTED" ||
    upper === "RESERVED" ||
    upper === "DEPOSIT_PAID";

  const c = toCanonicalStatus(raw);
  if (c === "cancelled") return "CANCELLED";
  if (c === "done") return "FULLY_PAID";
  if (c === "in_ops") return "PENDING_BALANCE";
  if (c === "confirmed") {
    return depositPaid || opts?.hasPaidFull
      ? opts?.hasPaidFull
        ? "FULLY_PAID"
        : "PENDING_BALANCE"
      : "DEPOSIT_PAID";
  }
  if (c === "quoted" || depositPaid) return "DEPOSIT_PAID";
  if (c === "incoming") return "PENDING_DEPOSIT";
  return "DRAFT";
}

/** Guest pass badge copy (exact taxonomy). */
export function guestBadgeForUnifiedStatus(status: UnifiedPbStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "DRAFT":
      return {
        label: "DRAFT",
        className:
          "rounded-md border border-gray-500/50 bg-gray-500/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-gray-300",
      };
    case "PENDING_DEPOSIT":
      return {
        label: "HOLD",
        className:
          "rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-black shadow-md",
      };
    case "PROCESSING":
      return {
        label: "PROCESSING",
        className:
          "animate-pulse rounded-md border border-sky-400/60 bg-sky-500/25 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-sky-200",
      };
    case "DEPOSIT_PAID":
      return {
        label: "RESERVED",
        className:
          "rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-black shadow-md",
      };
    case "PENDING_BALANCE":
      return {
        label: "PENDING BALANCE",
        className:
          "rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-black shadow-md",
      };
    case "FULLY_PAID":
      return {
        label: "CONFIRMED",
        className:
          "rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-black shadow-md",
      };
    case "CANCELLED":
      return {
        label: "CANCELLED",
        className:
          "rounded-md border border-[#E60F43]/70 bg-[#E60F43]/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-[#E60F43]",
      };
    default:
      return {
        label: "DRAFT",
        className:
          "rounded-md border border-gray-500/50 bg-gray-500/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase text-gray-300",
      };
  }
}

/** Ops dashboard view labels (exact taxonomy). */
export function opsLabelForUnifiedStatus(status: UnifiedPbStatus): string {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "PENDING_DEPOSIT":
      return "INCOMING (FEE NO)";
    case "PROCESSING":
      return "PROCESSING";
    case "DEPOSIT_PAID":
      return "QUOTE PENDING";
    case "PENDING_BALANCE":
      return "TOUR PAY PENDING";
    case "FULLY_PAID":
      return "CONFIRMED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "DRAFT";
  }
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
  | UnifiedPbStatus
  | "INCOMING"
  | "QUOTED"
  | "CONFIRMED"
  | "IN_OPS"
  | "DONE"
  | "IN_PROGRESS"
  | "REVIEW";

/** Guest-facing pass status — prefers unified PB taxonomy labels. */
export function toPassStatusLabel(
  status: CanonicalBookingStatus | string
): PassStatusLabel {
  return toUnifiedPbStatus(status);
}

export function canonicalStatusLabel(status?: string | null): string {
  return toCanonicalStatus(status).replace(/_/g, " ");
}

/**
 * Builder autosave stays DRAFT until the guest explicitly submits or emails.
 * Callers that only background-save must pass isSubmitted/sentViaEmail false.
 */
export function calculateInitialBookingStatus(data: {
  isSubmitted?: boolean;
  sentViaEmail?: boolean;
  guestEmail?: string | null;
  startDate?: string | null;
  selectedTours?: unknown[] | null;
  status?: string | null;
}): CanonicalBookingStatus {
  const existing = data.status != null ? toCanonicalStatus(data.status) : null;
  // Never demote ops-advanced states via this helper
  if (
    existing &&
    existing !== "draft" &&
    existing !== "incoming"
  ) {
    return existing;
  }

  const isSubmittedByClient =
    data.isSubmitted === true || data.sentViaEmail === true;
  const hasCompleteData = Boolean(
    data.guestEmail &&
      data.startDate &&
      Array.isArray(data.selectedTours) &&
      data.selectedTours.length > 0
  );

  if (isSubmittedByClient && hasCompleteData) {
    return "incoming";
  }
  return "draft";
}

/** Shared pass / ops pill classes — identical padding & type scale. */
export function statusPillClassName(
  status?: string | null
): string {
  const u = toUnifiedPbStatus(status);
  if (u === "DRAFT") {
    return "border-gray-500/30 bg-gray-500/20 text-gray-400";
  }
  if (u === "PENDING_DEPOSIT") {
    return "border-amber-500/30 bg-amber-500/20 text-amber-300";
  }
  if (u === "PROCESSING") {
    return "border-sky-500/40 bg-sky-500/20 text-sky-300 animate-pulse";
  }
  if (u === "PENDING_BALANCE") {
    return "border-orange-500/40 bg-orange-500/20 text-orange-300";
  }
  if (u === "CANCELLED") {
    return "border-red-500/40 bg-red-500/20 text-red-300";
  }
  if (u === "DEPOSIT_PAID" || u === "FULLY_PAID") {
    return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
  }
  return "border-blue-500/30 bg-blue-500/20 text-blue-300";
}

/** BAL write status for draft-phase autosaves (alias of draft in PB). */
export function draftLeadWriteStatus(): "lead" {
  return "lead";
}
