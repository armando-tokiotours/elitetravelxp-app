/**
 * Guest tour balance after Concierge Fee — 30% progress vs 100% full.
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
    input.totalPaidEur != null && input.totalPaidEur > 0
      ? input.totalPaidEur
      : credit
  );
  const pendingBalance = computePendingBalance(packageTotal, totalPaid);
  const progress30 = Math.round(pendingBalance * 0.3);
  return {
    packageTotal,
    credit,
    totalPaid,
    pendingBalance,
    progress30,
  };
}

export const CTA_PAY_BALANCE = "Pay tour balance";
