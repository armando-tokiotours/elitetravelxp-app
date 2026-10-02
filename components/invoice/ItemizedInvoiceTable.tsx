"use client";

import { formatEur } from "@/lib/singleDayPricing";

export type InvoiceItemStatus = "ACCEPTED" | "DECLINED" | "OPTIONAL";

export type InvoiceItem = {
  id: string;
  category: string;
  title: string;
  status: InvoiceItemStatus;
  basePriceEur: number;
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
  conciergeFeeAmount?: number;
  /** Concierge-approved locked package total (below estimate → deal badge) */
  finalApprovedPrice?: number | null;
  className?: string;
};

const CONTINGENCY = 1.3;

/**
 * Formal financial estimate table for dossier INVOICE tab.
 * Range = base ~ base × 1.30; deposit credit reduces pending balance.
 */
export function ItemizedInvoiceTable({
  pnr,
  guestName,
  partySize,
  items,
  conciergeFeePaid,
  conciergeFeeAmount = 60,
  finalApprovedPrice = null,
  className = "",
}: ItemizedInvoiceTableProps) {
  const pax = Math.max(1, partySize);
  const acceptedItems = items.filter((i) => i.status === "ACCEPTED");

  const baseSubtotal = Math.round(
    acceptedItems.reduce((acc, curr) => acc + Math.max(0, curr.basePriceEur), 0)
  );
  const maxSubtotal = Math.round(baseSubtotal * CONTINGENCY);

  const minPerPerson = Math.round(baseSubtotal / pax);
  const maxPerPerson = Math.round(maxSubtotal / pax);

  const depositCredit = conciergeFeePaid
    ? Math.max(0, Math.round(conciergeFeeAmount))
    : 0;
  const pendingMin = Math.max(0, baseSubtotal - depositCredit);
  const pendingMax = Math.max(0, maxSubtotal - depositCredit);

  const approved =
    finalApprovedPrice != null && Number.isFinite(finalApprovedPrice)
      ? Math.round(finalApprovedPrice)
      : null;
  const isDealUnlocked = approved != null && approved < baseSubtotal;
  const savingsAmount = isDealUnlocked ? baseSubtotal - approved! : 0;
  const pendingApproved =
    approved != null ? Math.max(0, approved - depositCredit) : null;

  return (
    <div
      className={`w-full space-y-6 rounded-3xl border border-white/10 bg-[#0A1017] p-5 text-xs text-white shadow-2xl sm:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
            Official estimated quotation
          </div>
          <h2 className="mt-0.5 font-godiva text-xl tracking-wide text-white uppercase">
            Invoice brief · {pnr}
          </h2>
          <p className="text-[11px] text-gray-400">
            Prepared for{" "}
            <strong className="text-white">{guestName || "Valued Guest"}</strong>{" "}
            ({pax} Guest{pax === 1 ? "" : "s"})
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-right">
          <span className="block font-mono text-[9px] text-gray-400 uppercase">
            Estimated package range
          </span>
          <div className="font-mono text-base font-bold text-[#F6A724]">
            {formatEur(baseSubtotal)} ~ {formatEur(maxSubtotal)}
          </div>
          <div className="font-mono text-[10px] text-gray-400">
            ({formatEur(minPerPerson)} ~ {formatEur(maxPerPerson)} / person)
          </div>
        </div>
      </div>

      {/* Deal unlocked */}
      {isDealUnlocked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 p-3.5 text-emerald-300">
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

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/10 bg-[#0D1117] text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              <th className="px-4 py-3">Service description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-center">Agreed status</th>
              <th className="px-4 py-3 text-right">Estimated subtotal</th>
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
                const hi = Math.round(Math.max(0, item.basePriceEur) * CONTINGENCY);
                const listPrice = Math.max(
                  0,
                  Math.round(Number(item.listPriceEur) || 0)
                );
                return (
                  <tr
                    key={item.id}
                    className={
                      isAccepted ? "bg-transparent" : "bg-white/[0.02] opacity-55"
                    }
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{item.title}</span>
                        {item.isBonus ? (
                          <span className="animate-pulse rounded border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                            🎁 COMPLIMENTARY BONUS
                          </span>
                        ) : null}
                      </div>
                      {item.notes ? (
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          {item.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-gray-400 uppercase">
                      {item.category}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isAccepted ? (
                        <span className="inline-block rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          ACCEPTED ✓
                        </span>
                      ) : item.status === "OPTIONAL" ? (
                        <span className="inline-block rounded border border-white/10 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                          OPTIONAL
                        </span>
                      ) : (
                        <span className="inline-block rounded border border-white/10 bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                          DECLINED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold">
                      {item.isBonus && isAccepted ? (
                        <div className="flex flex-col items-end">
                          {listPrice > 0 ? (
                            <span className="text-[10px] text-gray-500 line-through">
                              {formatEur(listPrice)}
                            </span>
                          ) : null}
                          <span className="font-bold text-purple-300">
                            €0 (Included)
                          </span>
                        </div>
                      ) : isAccepted ? (
                        <span className="text-white">
                          {formatEur(Math.round(item.basePriceEur))} ~{" "}
                          {formatEur(hi)}
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

      {/* Summary */}
      <div className="ml-auto max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <div className="flex justify-between gap-3 text-xs text-gray-300">
          <span>Itemized estimate subtotal</span>
          <span className="font-mono font-bold text-white">
            {formatEur(baseSubtotal)} ~ {formatEur(maxSubtotal)}
          </span>
        </div>

        <div className="flex justify-between gap-3 border-b border-white/10 pb-2 text-xs text-emerald-400">
          <span className="min-w-0 leading-snug">
            Deposit
            <span className="mt-0.5 block text-[10px] font-normal text-emerald-400/80">
              (100% credited)
            </span>
          </span>
          <span className="shrink-0 font-mono font-bold">
            −{formatEur(depositCredit)}
          </span>
        </div>

        <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-white">
          <span>Pending balance due</span>
          <span className="font-mono text-[#F6A724]">
            {isDealUnlocked && pendingApproved != null
              ? formatEur(pendingApproved)
              : `${formatEur(pendingMin)} ~ ${formatEur(pendingMax)}`}
          </span>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3 text-center font-mono text-[10px] text-gray-500">
        Estimates. Final exact rate is confirmed upon concierge approval.
      </div>
    </div>
  );
}
