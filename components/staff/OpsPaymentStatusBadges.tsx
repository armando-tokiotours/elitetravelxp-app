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
  compact = false,
  surface = "dark",
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
  /** Smaller sizing for Ops sidebar list cards only */
  compact?: boolean;
  /** Cream list rows need darker badge text; dark is the default elsewhere */
  surface?: "dark" | "cream";
}) {
  const status = deriveTourPaymentStatus(row);
  const feePaid = isConciergeFeeSettled(row);
  const tourPaid = isTourFullyPaid(row);
  const partial = isTourPartiallyPaid(row);
  const feeEur = Math.round(
    Number(row.concierge_fee_amount) || Number(row.deposit_amount) || 60
  );
  const pillSize = compact
    ? "px-1 py-0.5 text-[7.5px]"
    : "px-1.5 py-0.5 text-[9px]";
  const onCream = surface === "cream";

  return (
    <div
      className={`flex flex-wrap items-center ${compact ? "gap-0.5" : "gap-1"} ${className}`}
    >
      <span
        className={`rounded-md border font-semibold tracking-wider uppercase ${pillSize} ${
          feePaid
            ? onCream
              ? "border-emerald-700/40 bg-emerald-50 text-emerald-800"
              : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
            : onCream
              ? "border-slate-300 bg-slate-100 text-slate-600"
              : "border-white/10 bg-zinc-900 text-zinc-500"
        }`}
        title={status}
      >
        {feePaid ? `Fee ✓ €${feeEur}` : "Fee no"}
      </span>
      <span
        className={`rounded-md border font-semibold tracking-wider uppercase ${pillSize} ${
          tourPaid
            ? onCream
              ? "border-cyan-700/40 bg-cyan-50 text-cyan-800"
              : "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
            : partial
              ? onCream
                ? "border-cyan-700/35 bg-cyan-50 text-cyan-800"
                : "border-cyan-500/35 bg-cyan-500/15 text-cyan-200"
              : onCream
                ? "border-amber-700/40 bg-amber-100 text-amber-900"
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
