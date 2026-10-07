"use client";

import { formatEur } from "@/lib/singleDayPricing";
import { paymentBadgeForAmount } from "@/lib/balanceSettlement";

/**
 * Ribbon: guest payments toward the tour (fee and/or progress).
 * Labels follow amountPaid vs package total from PocketBase.
 */
export function FeePaidRibbon({
  feeEur,
  totalPaidEur,
  packageTotalEur = 0,
  className = "",
}: {
  feeEur: number;
  totalPaidEur?: number;
  packageTotalEur?: number;
  className?: string;
}) {
  const paid = Math.max(0, Math.round(Number(totalPaidEur) || feeEur || 0));
  if (!(paid > 0)) return null;
  const badge = paymentBadgeForAmount(paid, packageTotalEur);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-3 text-left print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent ${className}`}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black print:border print:border-gray-400 print:bg-transparent print:text-gray-900">
          ✓
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 print:text-gray-700">
            {badge.label || `Fee credit applied (${formatEur(paid)})`}
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-300 print:text-gray-600 sm:text-xs">
            {badge.fullyPaid
              ? "Your trip is 100% fully paid. No further action required."
              : badge.milestone30Met
                ? "30% progress secured — remaining balance due before travel."
                : "Your Concierge Deposit is 100% credited toward the final itinerary total."}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold text-emerald-400 print:text-gray-700">
        −{formatEur(paid)}
      </span>
    </div>
  );
}

/**
 * Invoice block: package total − paid = pending.
 */
export function FeeCreditInvoiceBlock({
  packageTotalEur,
  feeCreditEur,
  totalPaidEur,
  className = "",
}: {
  packageTotalEur: number;
  feeCreditEur: number;
  totalPaidEur?: number;
  className?: string;
}) {
  const credit = Math.max(0, Math.round(feeCreditEur));
  const paid = Math.max(0, Math.round(Number(totalPaidEur) || credit || 0));
  if (!(paid > 0)) return null;
  const total = Math.max(0, Math.round(packageTotalEur));
  const pending = Math.max(0, total - paid);
  const badge = paymentBadgeForAmount(paid, total);

  return (
    <div
      className={`mt-4 space-y-2 rounded-xl border border-[#1CA67F]/40 bg-black/30 px-4 py-3 text-left text-xs print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1CA67F] print:text-gray-700">
        {badge.label || "Payments applied"}
      </p>
      <div className="flex justify-between gap-3 text-white/80 print:text-gray-700">
        <span>Package estimate</span>
        <span className="tabular-nums font-semibold text-white print:text-gray-900">
          {formatEur(total)}
        </span>
      </div>
      <div className="flex justify-between gap-3 text-[#1CA67F] print:text-gray-700">
        <span>Already paid</span>
        <span className="tabular-nums font-semibold">− {formatEur(paid)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-sm font-bold text-white print:border-gray-200 print:text-gray-900">
        <span>Pending tour balance</span>
        <span className="tabular-nums">{formatEur(pending)}</span>
      </div>
      <p className="text-[10px] leading-relaxed text-white/45 print:text-gray-600">
        Total payments received so far — deducted from the package total.
      </p>
    </div>
  );
}
