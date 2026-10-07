/**
 * Guest tour balance after Concierge Fee — 30% of package (fee counts), then rest.
 */

import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";

export type BalancePayOption = "30_PERCENT" | "FULL";

export function roundEur(n: number): number {
  return Math.max(0, Math.round(Number(n) || 0));
}

export function computePendingBalance(
  packageTotalEur: number,
  totalPaidEur: number
): number {
  return Math.max(0, roundEur(packageTotalEur) - roundEur(totalPaidEur));
}

/** 30% of package total — Concierge Fee counts toward this milestone. */
export function computeProgress30Target(packageTotalEur: number): number {
  return Math.round(roundEur(packageTotalEur) * 0.3);
}

export function computeBalanceOptions(input: {
  packageTotalEur: number;
  conciergeCreditEur?: number;
  totalPaidEur?: number;
}) {
  const packageTotal = roundEur(input.packageTotalEur);
  const credit = roundEur(
    input.conciergeCreditEur ?? DEFAULT_CONCIERGE_FEE_EUR
  );
  const totalPaid = roundEur(
    Math.max(
      input.totalPaidEur != null && input.totalPaidEur > 0
        ? input.totalPaidEur
        : 0,
      credit
    )
  );
  const pendingBalance = computePendingBalance(packageTotal, totalPaid);
  const progress30Target = computeProgress30Target(packageTotal);
  /** Amount still needed to finish the 30% milestone (fee already counts). */
  const progress30Due = Math.max(
    0,
    Math.min(pendingBalance, progress30Target - totalPaid)
  );
  const progress30Met = totalPaid >= progress30Target || progress30Due <= 0;
  /** Show 30% option only when milestone not met and something is still due. */
  const show30Percent = !progress30Met && progress30Due > 0;

  return {
    packageTotal,
    credit,
    totalPaid,
    pendingBalance,
    /** @deprecated alias — amount due to finish 30% of package */
    progress30: progress30Due,
    progress30Due,
    progress30Target,
    progress30Met,
    show30Percent,
  };
}

export const CTA_PAY_BALANCE = "Pay tour balance";

export type PaymentBadgeKind = "none" | "fee" | "progress30" | "fully_paid";

/**
 * Hero / ribbon badge from a single amountPaid + package total (PocketBase source of truth).
 */
export function paymentBadgeForAmount(
  amountPaidEur: number,
  packageTotalEur: number
): {
  kind: PaymentBadgeKind;
  label: string;
  amountPaid: number;
  packageTotal: number;
  pendingBalance: number;
  milestone30Target: number;
  milestone30Met: boolean;
  fullyPaid: boolean;
} {
  const packageTotal = roundEur(packageTotalEur);
  const amountPaid = roundEur(amountPaidEur);
  const pendingBalance = computePendingBalance(packageTotal, amountPaid);
  const milestone30Target = computeProgress30Target(packageTotal);
  const fullyPaid =
    packageTotal > 0 ? amountPaid >= packageTotal || pendingBalance <= 0 : false;
  const milestone30Met =
    packageTotal > 0 ? amountPaid >= milestone30Target : false;

  let kind: PaymentBadgeKind = "none";
  let label = "";
  if (amountPaid > 0) {
    if (fullyPaid) {
      kind = "fully_paid";
      label = "Fully paid (✓)";
    } else if (milestone30Met) {
      kind = "progress30";
      label = `30% deposit secured (−€${amountPaid})`;
    } else {
      kind = "fee";
      label = `Fee credit applied (−€${amountPaid})`;
    }
  }

  return {
    kind,
    label,
    amountPaid,
    packageTotal,
    pendingBalance,
    milestone30Target,
    milestone30Met,
    fullyPaid,
  };
}
