"use client";

import {
  FlatInvoiceBrief,
  splitInvoicePayments,
  type InvoiceRow,
} from "@/components/ops/FlatInvoiceBrief";
import { InvoiceBriefEstimateBox } from "@/components/invoice/InvoiceBriefChrome";
import {
  isExactGuestPricing,
  resolveExactPackageTotalEur,
  type PriceMode,
} from "@/lib/agentServices";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { formatEur } from "@/lib/singleDayPricing";

export type InvoiceItemStatus = "ACCEPTED" | "DECLINED" | "OPTIONAL";

export type InvoiceItem = {
  id: string;
  category: string;
  title: string;
  status: InvoiceItemStatus;
  basePriceEur: number;
  /** Optional estimate ceiling (from Ops cart); defaults to base × contingency */
  estimateMaxEur?: number;
  notes?: string;
  /** Complimentary agent bonus — show gift badge + €0 billed */
  isBonus?: boolean;
  /** Struck-through list price when isBonus */
  listPriceEur?: number;
};

export type ItemizedInvoiceTableProps = {
  pnr: string;
  guestName: string;
  partySize: number;
  items: InvoiceItem[];
  conciergeFeePaid: boolean;
  /** Concierge fee / initial deposit amount (typically €60). */
  conciergeFeeAmount?: number;
  /** Total paid toward tour (fee + milestones). Falls back to fee when omitted. */
  totalPaidEur?: number;
  /** Concierge-approved locked package total (below estimate → deal badge) */
  finalApprovedPrice?: number | null;
  /** Ops Pricing Studio: estimate | exact (from ops_hub.extras.price_mode) */
  priceMode?: PriceMode | null;
  className?: string;
  /**
   * `full` — estimate + mobile FlatInvoiceBrief + desktop table (staff / legacy).
   * `desktop` — estimate + desktop table only; mobile owned by MobileDossierLayout.
   */
  composition?: "full" | "desktop";
};

export const INVOICE_CONTINGENCY = 1.3;

export function invoicePackageRangeEur(items: InvoiceItem[]): {
  packageMinEur: number;
  packageMaxEur: number;
} {
  const billableItems = items.filter(
    (i) => i.status === "ACCEPTED" && !i.isBonus
  );
  const packageMinEur = Math.round(
    billableItems.reduce(
      (acc, curr) => acc + Math.max(0, curr.basePriceEur),
      0
    )
  );
  const packageMaxEur = Math.round(
    billableItems.reduce((acc, curr) => {
      const min = Math.max(0, Math.round(curr.basePriceEur));
      const max =
        curr.estimateMaxEur != null && Number.isFinite(curr.estimateMaxEur)
          ? Math.max(min, Math.round(curr.estimateMaxEur))
          : Math.round(min * INVOICE_CONTINGENCY);
      return acc + max;
    }, 0)
  );
  return {
    packageMinEur,
    packageMaxEur: Math.max(packageMinEur, packageMaxEur),
  };
}

export function linePriceBounds(item: InvoiceItem): {
  minPrice: number;
  maxPrice: number;
} {
  const base = Math.max(0, Math.round(item.basePriceEur));
  const minPrice = item.isBonus ? 0 : base;
  const maxPrice = item.isBonus
    ? 0
    : item.estimateMaxEur != null && Number.isFinite(item.estimateMaxEur)
      ? Math.max(minPrice, Math.round(item.estimateMaxEur))
      : Math.round(base * INVOICE_CONTINGENCY);
  return { minPrice, maxPrice };
}

export function formatInvoiceLinePrice(
  item: InvoiceItem,
  exact: boolean
): string {
  const { minPrice, maxPrice } = linePriceBounds(item);
  if (exact || minPrice === maxPrice) return formatEur(minPrice);
  return `${formatEur(minPrice)} ~ ${formatEur(maxPrice)}`;
}

export function toFlatInvoiceRow(item: InvoiceItem): InvoiceRow {
  const { minPrice, maxPrice } = linePriceBounds(item);
  const status =
    item.status === "ACCEPTED"
      ? "ACCEPTED"
      : item.status === "OPTIONAL"
        ? "OPTIONAL"
        : "PENDING";
  const listPrice = Math.max(0, Math.round(Number(item.listPriceEur) || 0));
  const giftValue =
    listPrice > 0
      ? listPrice
      : item.isBonus
        ? Math.max(0, Math.round(Number(item.basePriceEur) || 0))
        : 0;
  return {
    id: item.id,
    description: item.title,
    category: item.category,
    status,
    minPrice,
    maxPrice,
    isBonus: Boolean(item.isBonus),
    listPriceEur: item.isBonus ? giftValue : undefined,
  };
}

/**
 * Formal financial estimate for dossier INVOICE tab.
 * Guest mobile: use MobileDossierLayout + FlatInvoiceBrief as siblings (composition="desktop").
 * Desktop: table + flat totals in one box.
 */
export function ItemizedInvoiceTable({
  pnr,
  guestName,
  partySize,
  items,
  conciergeFeePaid,
  conciergeFeeAmount = DEFAULT_CONCIERGE_FEE_EUR,
  totalPaidEur,
  finalApprovedPrice = null,
  priceMode = null,
  className = "",
  composition = "full",
}: ItemizedInvoiceTableProps) {
  const pax = Math.max(1, partySize);
  const { packageMinEur: baseSubtotal, packageMaxEur: maxSubtotal } =
    invoicePackageRangeEur(items);

  const feeCredit = conciergeFeePaid
    ? Math.max(0, Math.round(conciergeFeeAmount))
    : 0;
  const { amountPaid, baseDepositPaid, extraPaid } = splitInvoicePayments({
    totalPaidEur,
    feeCreditEur: feeCredit,
  });
  const pendingMin = Math.max(0, baseSubtotal - amountPaid);
  const pendingMax = Math.max(0, maxSubtotal - amountPaid);

  const isExact = isExactGuestPricing({
    priceMode,
    finalApprovedPrice,
    items,
  });
  const approved = resolveExactPackageTotalEur({
    priceMode,
    finalApprovedPrice,
    packageMinEur: baseSubtotal,
    items,
  });
  const isDealLocked = approved != null;
  const isDealUnlocked = isDealLocked && approved! < baseSubtotal;
  const savingsAmount = isDealUnlocked ? baseSubtotal - approved! : 0;
  const pendingApproved = isDealLocked
    ? Math.max(0, approved! - amountPaid)
    : null;

  const showMobileBrief = composition === "full";

  return (
    <div
      className={`w-full space-y-5 text-xs text-white print:bg-white print:text-black ${className}`}
    >
      {/* BOX 2 — Sole highlight: title + Estimated Package Range */}
      <InvoiceBriefEstimateBox
        pnr={pnr}
        guestName={guestName}
        partySize={pax}
        packageMinEur={baseSubtotal}
        packageMaxEur={maxSubtotal}
        finalApprovedPrice={approved}
        priceMode={priceMode}
      />

      {isDealUnlocked ? (
        <div
          className={
            showMobileBrief
              ? "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 p-3.5 text-emerald-300 print:border-gray-300 print:bg-transparent print:text-gray-700"
              : "hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 p-3.5 text-emerald-300 print:border-gray-300 print:bg-transparent print:text-gray-700 md:flex"
          }
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden>
              🎉
            </span>
            <div>
              <div className="text-xs font-bold uppercase">
                You saved! Deal unlocked
              </div>
              <div className="text-[10px] text-emerald-200/80">
                Your concierge negotiated partner rates below the initial
                estimate.
              </div>
            </div>
          </div>
          <div className="font-mono text-sm font-bold text-emerald-400">
            You save {formatEur(savingsAmount)}!
          </div>
        </div>
      ) : null}

      {/* Mobile BOX 3 — only when this table owns mobile (not MobileDossierLayout) */}
      {showMobileBrief ? (
        <div className="md:hidden print:block">
          <FlatInvoiceBrief
            items={items.map(toFlatInvoiceRow)}
            depositAmount={feeCredit}
            totalPaidEur={amountPaid}
            finalApprovedPrice={approved}
            priceMode={priceMode}
          />
        </div>
      ) : null}

      {/* Desktop — one parent: table + totals + caption (no second totals card) */}
      <div
        className={`hidden rounded-3xl border border-white/10 bg-[#0A1017] p-5 shadow-2xl print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:p-4 print:shadow-none md:block sm:p-6 ${
          showMobileBrief ? "print:hidden" : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold tracking-wider text-gray-400 uppercase print:border-gray-200 print:text-gray-600">
                <th className="px-4 py-3">Service description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Agreed status</th>
                <th className="px-4 py-3 text-right">
                  {isExact ? "Agreed rate" : "Estimated subtotal"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-zinc-500 italic"
                  >
                    No services selected yet — continue building your plan.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isAccepted = item.status === "ACCEPTED";
                  const listPrice = Math.max(
                    0,
                    Math.round(Number(item.listPriceEur) || 0),
                    item.isBonus
                      ? Math.round(Number(item.basePriceEur) || 0)
                      : 0
                  );
                  return (
                    <tr
                      key={item.id}
                      className={
                        isAccepted
                          ? "bg-transparent"
                          : "bg-white/[0.02] opacity-55"
                      }
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white print:text-gray-900">
                            {item.title}
                          </span>
                          {item.isBonus ? (
                            <span className="animate-pulse rounded border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300 print:animate-none print:border-gray-300 print:bg-transparent print:text-gray-900">
                              🎁 COMPLIMENTARY BONUS
                            </span>
                          ) : null}
                        </div>
                        {item.notes ? (
                          <div className="mt-0.5 text-[10px] text-gray-400 print:text-gray-600">
                            {item.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-gray-400 uppercase print:text-gray-600">
                        {item.category}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isAccepted ? (
                          <span className="inline-block rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 print:border-gray-300 print:bg-transparent print:text-gray-700">
                            ACCEPTED ✓
                          </span>
                        ) : item.status === "OPTIONAL" ? (
                          <span className="inline-block rounded border border-white/10 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 print:border-gray-200 print:bg-transparent print:text-gray-600">
                            OPTIONAL
                          </span>
                        ) : (
                          <span className="inline-block rounded border border-white/10 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400 print:border-gray-200 print:bg-transparent print:text-gray-600">
                            DECLINED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        {item.isBonus && isAccepted ? (
                          <div className="flex flex-col items-end">
                            {listPrice > 0 ? (
                              <span className="text-[10px] text-gray-500 line-through">
                                {formatEur(listPrice)} Value
                              </span>
                            ) : null}
                            <span className="font-bold text-[#F6A724] print:text-gray-900">
                              FREE
                            </span>
                          </div>
                        ) : isAccepted ? (
                          <span className="text-white print:text-gray-900">
                            {formatInvoiceLinePrice(item, isExact)}
                          </span>
                        ) : (
                          <span className="text-gray-500 line-through">€0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-6 max-w-sm space-y-3 border-t border-white/10 pt-4 print:border-gray-200">
          <div className="flex justify-between gap-3 text-xs text-gray-300 print:text-gray-700">
            <span>
              {isDealLocked
                ? "Final Approved Package"
                : "Itemized estimate subtotal"}
            </span>
            <span className="font-mono font-bold text-white print:text-gray-900">
              {isDealLocked
                ? formatEur(approved!)
                : `${formatEur(baseSubtotal)} ~ ${formatEur(maxSubtotal)}`}
            </span>
          </div>

          {baseDepositPaid > 0 ? (
            <div className="flex justify-between gap-3 text-xs text-emerald-400 print:text-gray-700">
              <span className="min-w-0 leading-snug">
                Concierge Deposit
                <span className="mt-0.5 block text-[10px] font-normal text-emerald-400/80 print:text-gray-600">
                  (100% credited)
                </span>
              </span>
              <span className="shrink-0 font-mono font-bold">
                −{formatEur(baseDepositPaid)}
              </span>
            </div>
          ) : null}

          {extraPaid > 0 ? (
            <div className="flex justify-between gap-3 text-xs text-emerald-400 print:text-gray-700">
              <span className="min-w-0 leading-snug">
                30% Milestone Payment
                <span className="mt-0.5 block text-[10px] font-normal text-emerald-400/80 print:text-gray-600">
                  (Installment received)
                </span>
              </span>
              <span className="shrink-0 font-mono font-bold">
                −{formatEur(extraPaid)}
              </span>
            </div>
          ) : null}

          <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-white print:text-gray-900">
            <span>Pending balance due</span>
            <span className="font-mono text-[#F6A724] print:text-gray-900">
              {pendingApproved != null
                ? formatEur(pendingApproved)
                : `${formatEur(pendingMin)} ~ ${formatEur(pendingMax)}`}
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-white/5 pt-3 text-center font-mono text-[10px] text-gray-500 print:border-gray-200 print:text-gray-600">
          {isDealLocked
            ? "Confirmed package total. Concierge-approved rate locked."
            : "Estimates. Final exact rate is confirmed upon concierge approval."}
        </div>
      </div>
    </div>
  );
}
