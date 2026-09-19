"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatUsd } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";

export function PriceSummaryFooter({
  quoteMin,
  quoteMax,
  minPerPerson,
  maxPerPerson,
  totalGuests,
  onRequestPay,
  requestDisabled,
}: {
  quoteMin: number | null;
  quoteMax: number | null;
  minPerPerson: number | null;
  maxPerPerson: number | null;
  totalGuests: number;
  onRequestPay: () => void;
  requestDisabled?: boolean;
}) {
  const customBudgetTarget = useBuilderStore((s) => s.customBudgetTarget);
  const hasTarget = customBudgetTarget != null && customBudgetTarget > 0;

  return (
    <div className="no-print sticky-action-bar fixed inset-x-0 bottom-16 z-30 mb-2 w-full px-4 md:bottom-4 md:pl-16">
      <div className="mx-auto flex w-full max-w-5xl flex-row items-stretch justify-between gap-3 overflow-x-hidden">
        {/* Card 1 — calculated estimate (left) */}
        <div className="flex flex-1 flex-col justify-between gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500">
              Experience Japan Range
            </p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-white">
              {quoteMin != null && quoteMax != null
                ? `Est. ${formatUsd(quoteMin)} – ${formatUsd(quoteMax)}`
                : "Calculating…"}
            </p>
            {minPerPerson != null && maxPerPerson != null ? (
              <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                {formatUsd(minPerPerson)} – {formatUsd(maxPerPerson)} / pax
                {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={requestDisabled || quoteMin == null}
            onClick={onRequestPay}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            Request & Pay
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* Card 2 — target budget (right) → /budget-planner */}
        <div className="flex flex-1 flex-col justify-between gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
              Your Target Budget
            </p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-white">
              {hasTarget
                ? `Target: ${formatUsd(customBudgetTarget)}`
                : "Custom Budget"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-zinc-400">
              Tailored plan options
            </p>
          </div>
          <Link
            href="/budget-planner"
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-zinc-900 px-3 py-1.5 text-center text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
          >
            <span>🎯 Set Budget</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
