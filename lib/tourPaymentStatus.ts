/**
 * Concierge Fee vs Full Tour Pay — single source of truth helpers.
 */

import { CTA_PAY_BALANCE } from "@/lib/balanceSettlement";

export type TourPaymentStatus =
  | "UNPAID"
  | "FEE_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

export function deriveTourPaymentStatus(input: {
  concierge_fee_paid?: boolean | null;
  payment_confirmed?: boolean | null;
  tour_payment_status?: string | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
}): TourPaymentStatus {
  const explicit = String(input.tour_payment_status || "")
    .trim()
    .toUpperCase();
  if (
    explicit === "UNPAID" ||
    explicit === "FEE_PAID" ||
    explicit === "PARTIALLY_PAID" ||
    explicit === "FULLY_PAID"
  ) {
    return explicit;
  }

  const feeAmt = Math.max(
    0,
    Number(input.concierge_fee_amount) || Number(input.deposit_amount) || 0
  );
  const feePaid = Boolean(input.concierge_fee_paid);
  const tourPaid = Boolean(input.payment_confirmed);

  // Soft-heal classic inversion: tour pay Yes + fee no + small deposit
  if (tourPaid && !feePaid && feeAmt > 0 && feeAmt <= 100) {
    return "FEE_PAID";
  }

  if (tourPaid) return "FULLY_PAID";
  if (feePaid) return "FEE_PAID";
  return "UNPAID";
}

export function isConciergeFeeSettled(input: {
  concierge_fee_paid?: boolean | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
}): boolean {
  const s = deriveTourPaymentStatus(input);
  return (
    s === "FEE_PAID" ||
    s === "PARTIALLY_PAID" ||
    s === "FULLY_PAID" ||
    Boolean(input.concierge_fee_paid)
  );
}

export function isTourFullyPaid(input: {
  concierge_fee_paid?: boolean | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
}): boolean {
  return deriveTourPaymentStatus(input) === "FULLY_PAID";
}

export function isTourPartiallyPaid(input: {
  concierge_fee_paid?: boolean | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
}): boolean {
  return deriveTourPaymentStatus(input) === "PARTIALLY_PAID";
}

/** Toolbar / sticky CTA when fee not yet paid. */
export const CTA_SECURE_DEPOSIT = "Secure Dates";

/** @deprecated Prefer CTA_PAY_BALANCE after fee */
export const CTA_VIEW_BALANCE = CTA_PAY_BALANCE;

/** Alternate after fee — continue building with agent. */
export const CTA_CUSTOMIZE_CONCIERGE = "Customize with concierge";

export function dossierPrimaryCtaLabel(feeCreditEur: number): string {
  return feeCreditEur > 0 ? CTA_PAY_BALANCE : CTA_SECURE_DEPOSIT;
}
