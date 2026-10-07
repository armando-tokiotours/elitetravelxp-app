"use client";

import type { ReactNode } from "react";
import {
  isExactGuestPricing,
  resolveExactPackageTotalEur,
  type PriceMode,
} from "@/lib/agentServices";
import { formatEur } from "@/lib/singleDayPricing";

/** Flat label/value row — no per-row card chrome. */
export function InvoiceMetaRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 print:text-gray-600">
        {label}
      </span>
      <span className="font-bold text-white print:text-gray-900 sm:text-right">
        {value}
      </span>
    </div>
  );
}

/**
 * BOX 1 — Trip details shell (desktop / print).
 * Flat InvoiceMetaRow children only — do not nest Box 2/3 inside.
 */
export function InvoiceMetaList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0A1017] print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:shadow-none ${className}`.trim()}
    >
      <div className="divide-y divide-white/10 px-5 print:divide-gray-200">
        {children}
      </div>
    </div>
  );
}

/**
 * BOX 2 — Sole highlight for Invoice Brief title + Estimated Package Range.
 * Keep FlatInvoiceBrief / itemized tables outside this wrapper (sibling, not child).
 */
export function InvoiceBriefEstimateBox({
  pnr,
  guestName,
  partySize,
  packageMinEur,
  packageMaxEur,
  finalApprovedPrice = null,
  priceMode = null,
}: {
  pnr: string;
  guestName: string;
  partySize: number;
  packageMinEur: number;
  packageMaxEur: number;
  /** Ops deal lock — when >0 show exact confirmed total (no range). */
  finalApprovedPrice?: number | null;
  /** Ops Pricing Studio: estimate | exact (ops_hub.extras.price_mode). */
  priceMode?: PriceMode | null;
}) {
  const pax = Math.max(1, partySize);
  const min = Math.max(0, Math.round(packageMinEur));
  const max = Math.max(min, Math.round(packageMaxEur));
  const approved = resolveExactPackageTotalEur({
    priceMode,
    finalApprovedPrice,
    packageMinEur: min,
  });
  const isDealLocked =
    approved != null ||
    isExactGuestPricing({
      priceMode,
      finalApprovedPrice,
      items:
        min === max && min > 0
          ? [{ status: "ACCEPTED", basePriceEur: min, estimateMaxEur: max }]
          : null,
    });
  const lockedTotal = approved ?? (isDealLocked ? min : null);
  const lockedPerPerson =
    lockedTotal != null ? Math.round(lockedTotal / pax) : 0;
  const minPerPerson = Math.round(min / pax);
  const maxPerPerson = Math.round(max / pax);
  const rangeLabel =
    min === max ? formatEur(min) : `${formatEur(min)} ~ ${formatEur(max)}`;
  const perPersonLabel =
    minPerPerson === maxPerPerson
      ? formatEur(minPerPerson)
      : `${formatEur(minPerPerson)} ~ ${formatEur(maxPerPerson)}`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#F6A724]/30 bg-[#0A1017] p-5 shadow-2xl print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:p-4 print:shadow-none">
      <div
        className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-[#F6A724]/25 blur-2xl print:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-[#F6A724]/10 blur-2xl print:hidden"
        aria-hidden
      />
      <div className="relative z-10 space-y-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#F6A724] uppercase print:text-gray-900">
            {isDealLocked
              ? "Official Confirmed Quotation"
              : "Official Estimated Quotation"}
          </div>
          <h2 className="mt-0.5 font-godiva text-xl tracking-wide text-white uppercase print:text-gray-900">
            Invoice Brief · {pnr}
          </h2>
          <p className="mt-1 text-[11px] text-gray-400 print:text-gray-600">
            Prepared for{" "}
            <strong className="text-white print:text-gray-900">
              {guestName || "Valued Guest"}
            </strong>{" "}
            ({pax} Guest{pax === 1 ? "" : "s"})
          </p>
        </div>

        <div className="border-t border-[#F6A724]/15 pt-3 print:border-gray-200">
          <span className="block font-mono text-[9px] tracking-widest text-gray-400 uppercase print:text-gray-600">
            {isDealLocked
              ? "Confirmed Package Total"
              : "Estimated Package Range"}
          </span>
          {isDealLocked && lockedTotal != null ? (
            <>
              <div className="mt-1 font-mono text-2xl font-bold text-[#F6A724] tabular-nums print:text-gray-900">
                {formatEur(lockedTotal)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-gray-400 tabular-nums print:text-gray-600">
                {formatEur(lockedPerPerson)} / person
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 font-mono text-2xl font-bold text-[#F6A724] tabular-nums print:text-gray-900">
                {perPersonLabel} / person
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-gray-400 tabular-nums print:text-gray-600">
                Total · {rangeLabel}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
