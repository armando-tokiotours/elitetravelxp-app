"use client";

import {
  breakdownFromJob,
  formatYenJpy,
  type GuidePayBreakdown,
} from "@/lib/guidePayBreakdown";

/**
 * Compact guide day payout: base + ¥ expenses + specialty = total.
 */
export function GuidePayoutBreakdown({
  job,
  breakdown: override,
  compact = false,
  totalOnly = false,
  hideTotal = false,
  className = "",
}: {
  job?: {
    payout_jpy?: number;
    base_pay_jpy?: number;
    expenses_jpy?: number;
    specialty_bonus_jpy?: number;
    duration_hours?: number;
  } | null;
  breakdown?: GuidePayBreakdown | null;
  compact?: boolean;
  /** Only the "Total day payout ¥…" row — for condensed card headers. */
  totalOnly?: boolean;
  /** Omit the closing total row (caller already shows the total). */
  hideTotal?: boolean;
  className?: string;
}) {
  const bd =
    override ||
    (job
      ? breakdownFromJob(job)
      : {
          basePayJpy: 0,
          expensesJpy: 0,
          specialtyBonusJpy: 0,
          totalPayoutJpy: 0,
          source: "fallback" as const,
        });

  if (totalOnly) {
    return (
      <div
        className={`flex items-center justify-between gap-3 border-t border-white/10 pt-3 ${className}`}
      >
        <span className="text-xs font-bold text-zinc-300">
          Total day payout
        </span>
        <span className="font-mono text-sm font-black text-[#F6A724]">
          {formatYenJpy(bd.totalPayoutJpy)}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`text-right ${className}`}>
        <p className="font-mono text-sm font-bold text-white">
          {formatYenJpy(bd.totalPayoutJpy)}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Base {formatYenJpy(bd.basePayJpy)}
          {" + "}
          Exp {formatYenJpy(bd.expensesJpy)}
          {bd.specialtyBonusJpy > 0
            ? ` + Spec ${formatYenJpy(bd.specialtyBonusJpy)}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-3 text-zinc-400">
        <span>Base guide rate</span>
        <span className="font-mono text-zinc-200">
          {formatYenJpy(bd.basePayJpy)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-zinc-400">
        <span>Day expense allowance</span>
        <span className="font-mono text-zinc-200">
          {formatYenJpy(bd.expensesJpy)}
        </span>
      </div>
      {bd.specialtyBonusJpy > 0 ? (
        <div className="mt-1 flex items-center justify-between gap-3 text-amber-300/90">
          <span>Specialty bonus</span>
          <span className="font-mono">
            +{formatYenJpy(bd.specialtyBonusJpy)}
          </span>
        </div>
      ) : null}
      {hideTotal ? null : (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
          <span className="font-semibold text-white">Total day payout</span>
          <span className="font-mono text-sm font-bold text-[#F6A724]">
            {formatYenJpy(bd.totalPayoutJpy)}
          </span>
        </div>
      )}
    </div>
  );
}
