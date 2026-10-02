"use client";

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  deriveTourPaymentStatus,
  isConciergeFeeSettled,
  isTourFullyPaid,
  isTourPartiallyPaid,
} from "@/lib/tourPaymentStatus";

/**
 * Always-visible Fee + Tour Pay pills (never conflate €60 fee with full pay).
 */
export function OpsPaymentStatusBadges({
  row,
  className = "",
}: {
  row: Pick<
    OpsHubRow,
    | "concierge_fee_paid"
    | "payment_confirmed"
    | "deposit_amount"
    | "concierge_fee_amount"
    | "tour_payment_status"
  >;
  className?: string;
}) {
  const status = deriveTourPaymentStatus(row);
  const feePaid = isConciergeFeeSettled(row);
  const tourPaid = isTourFullyPaid(row);
  const partial = isTourPartiallyPaid(row);
  const feeEur = Math.round(
    Number(row.concierge_fee_amount) || Number(row.deposit_amount) || 60
  );

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${
          feePaid
            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
            : "border-white/10 bg-zinc-900 text-zinc-500"
        }`}
        title={status}
      >
        {feePaid ? `Fee ✓ €${feeEur}` : "Fee no"}
      </span>
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${
          tourPaid
            ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
            : partial
              ? "border-cyan-500/35 bg-cyan-500/15 text-cyan-200"
              : "border-amber-500/35 bg-amber-500/15 text-amber-200"
        }`}
      >
        {tourPaid
          ? "Tour pay Yes"
          : partial
            ? "30% paid"
            : "Tour pay pending"}
      </span>
    </div>
  );
}
