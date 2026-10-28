/**
 * Client-safe payment-dispatch helpers (no Node/fs, no mail).
 * Server send/idempotency lives in paymentDispatchEngine.
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { paymentBadgeForAmount, roundEur } from "@/lib/balanceSettlement";
import type { PaymentDispatchThreshold } from "@/lib/paymentDispatchTemplates";
import { isPaymentUnlockedForTickets } from "@/lib/ticketsMasterDesk";
import { deriveTourPaymentStatus } from "@/lib/tourPaymentStatus";

export type PaymentDispatchLogEntry = {
  at: string;
  source: "auto" | "manual";
  guideEmailed?: boolean;
  driverEmailed?: boolean;
  ticketsUpdated?: boolean;
  skipped?: string;
};

export type PaymentDispatchExtras = {
  deposit_30?: PaymentDispatchLogEntry;
  full_100?: PaymentDispatchLogEntry;
};

export type PaymentDispatchHubFields = {
  id?: string;
  pnr?: string;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  tickets_needed?: boolean | null;
  ticket_status?: string | null;
  extras?: unknown;
};

export function readPaymentDispatchFlags(
  extras: unknown
): PaymentDispatchExtras {
  let obj: Record<string, unknown> = {};
  if (typeof extras === "string") {
    try {
      obj = JSON.parse(extras) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (extras && typeof extras === "object") {
    obj = extras as Record<string, unknown>;
  }
  const raw = obj.payment_dispatch;
  if (!raw || typeof raw !== "object") return {};
  return raw as PaymentDispatchExtras;
}

/**
 * Highest threshold currently met from real ops_hub payment fields.
 * Uses total_paid_eur + estimated_total_eur badge, tour_payment_status,
 * and classifyPaymentLane-compatible unlock helpers.
 */
export function detectPaymentDispatchThreshold(
  hub: PaymentDispatchHubFields
): PaymentDispatchThreshold | null {
  const paid = roundEur(Number(hub.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  const status = deriveTourPaymentStatus(hub);
  const badge =
    packageTotal > 0 && paid > 0
      ? paymentBadgeForAmount(paid, packageTotal)
      : null;

  const fullyPaid =
    status === "FULLY_PAID" ||
    Boolean(badge?.fullyPaid) ||
    (packageTotal > 0 && paid >= packageTotal);

  if (fullyPaid) return "full_100";

  const deposit30 =
    status === "PARTIALLY_PAID" ||
    badge?.kind === "progress30" ||
    Boolean(badge?.milestone30Met) ||
    isPaymentUnlockedForTickets(hub as OpsHubRow);

  if (deposit30) return "deposit_30";
  return null;
}
