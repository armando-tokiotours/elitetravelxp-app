"use client";

import { formatEur } from "@/lib/singleDayPricing";

/**
 * Ribbon: guest already paid the Concierge Fee (not full tour pay).
 * Server-hydrated via PNR — do not rely on session alone.
 */
export function FeePaidRibbon({
  feeEur,
  className = "",
}: {
  feeEur: number;
  className?: string;
}) {
  if (!(feeEur > 0)) return null;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-3 text-left ${className}`}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">
          ✓
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Fee credit applied ({formatEur(feeEur)})
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-300 sm:text-xs">
            Your Concierge Deposit is 100% credited toward the final itinerary
            total — not full tour payment.
          </p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold text-emerald-400">
        −{formatEur(feeEur)}
      </span>
    </div>
  );
}

/**
 * Invoice block: package total − fee credit = pending.
 */
export function FeeCreditInvoiceBlock({
  packageTotalEur,
  feeCreditEur,
  className = "",
}: {
  packageTotalEur: number;
  feeCreditEur: number;
  className?: string;
}) {
  if (!(feeCreditEur > 0)) return null;
  const total = Math.max(0, Math.round(packageTotalEur));
  const credit = Math.max(0, Math.round(feeCreditEur));
  const pending = Math.max(0, total - credit);

  return (
    <div
      className={`mt-4 space-y-2 rounded-xl border border-[#1CA67F]/40 bg-black/30 px-4 py-3 text-left text-xs ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1CA67F]">
        Fee credit applied
      </p>
      <div className="flex justify-between gap-3 text-white/80">
        <span>Package estimate</span>
        <span className="tabular-nums font-semibold text-white">
          {formatEur(total)}
        </span>
      </div>
      <div className="flex justify-between gap-3 text-[#1CA67F]">
        <span>Concierge deposit (credit)</span>
        <span className="tabular-nums font-semibold">
          − {formatEur(credit)}
        </span>
      </div>
      <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-sm font-bold text-white">
        <span>Pending tour balance</span>
        <span className="tabular-nums">{formatEur(pending)}</span>
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        The {formatEur(credit)} fee is not the full tour payment. Remaining
        balance is confirmed with your agent.
      </p>
    </div>
  );
}
