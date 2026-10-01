/**
 * Golden rule: booking cannot be "confirmed" (or later) without payment_confirmed.
 */

import type { CanonicalBookingStatus } from "@/lib/bookingStatus";
import { toCanonicalStatus } from "@/lib/bookingStatus";

const PAYMENT_LOCKED: CanonicalBookingStatus[] = [
  "confirmed",
  "in_ops",
  "done",
];

export function statusRequiresPayment(status?: string | null): boolean {
  const c = toCanonicalStatus(status);
  return PAYMENT_LOCKED.includes(c);
}

/** Effective status for display / pass — never Confirmed without payment. */
export function coerceStatusWithPayment(
  status?: string | null,
  paymentConfirmed?: boolean
): CanonicalBookingStatus {
  const c = toCanonicalStatus(status);
  if (!paymentConfirmed && statusRequiresPayment(c)) {
    return "incoming";
  }
  return c;
}

export function assertStatusAllowedWithPayment(
  status: string,
  paymentConfirmed: boolean
): void {
  if (!paymentConfirmed && statusRequiresPayment(status)) {
    throw new Error(
      "Payment must be confirmed before booking status can be Confirmed (or later)."
    );
  }
}
