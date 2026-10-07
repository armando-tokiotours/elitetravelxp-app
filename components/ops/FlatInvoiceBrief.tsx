"use client";

import {
  isExactGuestPricing,
  resolveExactPackageTotalEur,
  type PriceMode,
} from "@/lib/agentServices";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { formatEur } from "@/lib/singleDayPricing";

export interface InvoiceRow {
  id: string;
  description: string;
  category: string;
  status: string;
  minPrice: number;
  maxPrice: number;
  /** Complimentary perk — shown as gift value, excluded from totals */
  isBonus?: boolean;
  /** Representative list value for bonus lines (guest delight) */
  listPriceEur?: number;
}

type BadgeStatus = "ACCEPTED" | "PENDING" | "OPTIONAL";

function normalizeStatus(status: string): BadgeStatus {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  if (s === "ACCEPTED") return "ACCEPTED";
  if (s === "OPTIONAL") return "OPTIONAL";
  // DECLINED, approvalPending, PENDING, etc.
  return "PENDING";
}

function StatusBadge({ status }: { status: BadgeStatus }) {
  if (status === "ACCEPTED") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-300 uppercase print:border-gray-300 print:bg-transparent print:text-gray-700">
        ACCEPTED ✓
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-300 uppercase print:border-gray-300 print:bg-transparent print:text-gray-700">
        PENDING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-gray-400 uppercase print:border-gray-200 print:bg-transparent print:text-gray-600">
      OPTIONAL
    </span>
  );
}

function formatPriceRange(min: number, max: number): string {
  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo, Math.round(max));
  if (lo === hi) return formatEur(lo);
  return `${formatEur(lo)} ~ ${formatEur(hi)}`;
}

function bonusDisplayValue(item: InvoiceRow): number {
  const list = Math.max(0, Math.round(Number(item.listPriceEur) || 0));
  if (list > 0) return list;
  const max = Math.max(0, Math.round(Number(item.maxPrice) || 0));
  if (max > 0) return max;
  return Math.max(0, Math.round(Number(item.minPrice) || 0));
}

/** Split guest payments into concierge deposit vs 30% milestone. */
export function splitInvoicePayments(opts: {
  totalPaidEur?: number;
  feeCreditEur?: number;
}): {
  amountPaid: number;
  baseDepositPaid: number;
  extraPaid: number;
} {
  const feeCredit = Math.max(0, Math.round(Number(opts.feeCreditEur) || 0));
  const amountPaid = Math.max(
    0,
    Math.round(Number(opts.totalPaidEur) || 0) || feeCredit
  );
  const initialDeposit = feeCredit || DEFAULT_CONCIERGE_FEE_EUR;
  const baseDepositPaid = Math.min(amountPaid, initialDeposit);
  const extraPaid = Math.max(0, amountPaid - initialDeposit);
  return { amountPaid, baseDepositPaid, extraPaid };
}

export function FlatInvoiceBrief({
  items,
  depositAmount = 0,
  totalPaidEur,
  finalApprovedPrice = null,
  priceMode = null,
}: {
  items: InvoiceRow[];
  /** Concierge fee / initial deposit amount (typically €60). Cap for Concierge Deposit row. */
  depositAmount?: number;
  /** Total paid toward tour (fee + milestones). Falls back to depositAmount when omitted. */
  totalPaidEur?: number;
  /** Ops deal lock from ops_hub.extras.final_approved_price (>0 → exact totals). */
  finalApprovedPrice?: number | null;
  /** Ops Pricing Studio: estimate | exact (ops_hub.extras.price_mode). */
  priceMode?: PriceMode | null;
}) {
  const accepted = items.filter(
    (i) => normalizeStatus(i.status) === "ACCEPTED"
  );
  const billableItems = accepted.filter((i) => !i.isBonus);
  const subtotalMin = billableItems.reduce(
    (sum, i) => sum + Math.max(0, Math.round(i.minPrice)),
    0
  );
  const subtotalMax = billableItems.reduce(
    (sum, i) =>
      sum +
      Math.max(Math.max(0, Math.round(i.minPrice)), Math.round(i.maxPrice)),
    0
  );
  const { amountPaid, baseDepositPaid, extraPaid } = splitInvoicePayments({
    totalPaidEur,
    feeCreditEur: depositAmount,
  });
  const isExact = isExactGuestPricing({
    priceMode,
    finalApprovedPrice,
    items,
  });
  const approved = resolveExactPackageTotalEur({
    priceMode,
    finalApprovedPrice,
    packageMinEur: subtotalMin,
    items,
  });
  const isDealLocked = approved != null;
  const pendingMin = Math.max(0, subtotalMin - amountPaid);
  const pendingMax = Math.max(0, subtotalMax - amountPaid);
  const pendingLocked = isDealLocked
    ? Math.max(0, approved! - amountPaid)
    : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0A1017] p-5 print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:p-4 print:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 print:border-gray-200">
        <span className="text-[11px] font-bold tracking-wider text-white uppercase print:text-gray-900">
          Service Description
        </span>
        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase print:text-gray-600">
          {isExact ? "Agreed Rate" : "Estimated Rate"}
        </span>
      </div>

      {/* Flat service rows */}
      {items.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-zinc-500 print:text-gray-600">
          No services selected yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 print:divide-gray-200">
          {items.map((item) => {
            const status = normalizeStatus(item.status);
            const muted = status !== "ACCEPTED" && !item.isBonus;
            const giftValue = bonusDisplayValue(item);
            const lineExact =
              isExact ||
              Math.max(0, Math.round(item.minPrice)) ===
                Math.max(
                  Math.max(0, Math.round(item.minPrice)),
                  Math.round(item.maxPrice)
                );
            const title = String(item.description || "").replace(/^🎁\s*/, "");
            return (
              <li
                key={item.id}
                className={`flex items-start justify-between gap-3 py-3.5 ${
                  muted ? "opacity-60 print:opacity-80" : ""
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white print:text-gray-900">
                    {item.isBonus ? <span aria-hidden>🎁</span> : null}
                    <span className="truncate">{title}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold tracking-wide text-zinc-500 uppercase print:text-gray-600">
                      {item.category}
                    </span>
                    {item.isBonus ? (
                      <span className="rounded-md border border-[#F6A724]/40 bg-[#F6A724]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#F6A724] uppercase print:border-gray-300 print:bg-transparent print:text-gray-900">
                        COMPLIMENTARY
                      </span>
                    ) : (
                      <StatusBadge status={status} />
                    )}
                  </div>
                </div>
                <div className="shrink-0 pt-0.5 text-right">
                  {item.isBonus ? (
                    <span className="font-mono text-sm font-bold text-[#F6A724] tabular-nums print:text-gray-900">
                      {giftValue > 0 ? (
                        <>
                          <span className="mr-1 text-gray-400 line-through opacity-50 print:text-gray-500">
                            {formatEur(giftValue)}
                          </span>
                          FREE
                        </>
                      ) : (
                        "FREE"
                      )}
                    </span>
                  ) : status === "ACCEPTED" ? (
                    <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-gray-700">
                      {lineExact
                        ? formatEur(Math.max(0, Math.round(item.minPrice)))
                        : formatPriceRange(item.minPrice, item.maxPrice)}
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-zinc-500 line-through tabular-nums print:text-gray-600">
                      {formatEur(0)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Totals — same parent, no second card */}
      <div className="mt-2 space-y-3 border-t border-white/10 pt-4 print:border-gray-200">
        <div className="flex items-center justify-between gap-3 text-xs text-gray-300 print:text-gray-700">
          <span>
            {isDealLocked
              ? "Final Approved Package"
              : "Itemized estimate subtotal"}
          </span>
          <span className="font-mono font-bold text-white tabular-nums print:text-gray-900">
            {isDealLocked
              ? formatEur(approved!)
              : formatPriceRange(subtotalMin, subtotalMax)}
          </span>
        </div>
        {baseDepositPaid > 0 ? (
          <div className="flex items-center justify-between gap-3 text-xs text-emerald-400 print:text-gray-700">
            <span className="leading-snug">
              Concierge Deposit
              <span className="mt-0.5 block text-[10px] font-normal text-emerald-400/80 print:text-gray-600">
                (100% credited)
              </span>
            </span>
            <span className="shrink-0 font-mono font-bold tabular-nums">
              −{formatEur(baseDepositPaid)}
            </span>
          </div>
        ) : null}
        {extraPaid > 0 ? (
          <div className="flex items-center justify-between gap-3 text-xs text-emerald-400 print:text-gray-700">
            <span className="leading-snug">
              30% Milestone Payment
              <span className="mt-0.5 block text-[10px] font-normal text-emerald-400/80 print:text-gray-600">
                (Installment received)
              </span>
            </span>
            <span className="shrink-0 font-mono font-bold tabular-nums">
              −{formatEur(extraPaid)}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#F6A724] print:text-gray-900">
          <span>Pending balance due</span>
          <span className="font-mono text-base tabular-nums">
            {pendingLocked != null
              ? formatEur(pendingLocked)
              : formatPriceRange(pendingMin, pendingMax)}
          </span>
        </div>
      </div>

      <p className="mt-4 border-t border-white/5 pt-3 text-center font-mono text-[10px] text-gray-500 print:border-gray-200 print:text-gray-600">
        {isDealLocked
          ? "Confirmed package total. Concierge-approved rate locked."
          : "Estimates. Final exact rate is confirmed upon concierge approval."}
      </p>
    </div>
  );
}
