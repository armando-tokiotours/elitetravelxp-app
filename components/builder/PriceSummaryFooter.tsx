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
    <div className="no-print sticky-action-bar fixed inset-x-0 bottom-16 z-30 mx-auto mb-2 w-full max-w-xl px-3 md:bottom-4 md:pl-16">
      <div className="flex flex-col gap-2 overflow-x-hidden">
        {/* Top — calculated estimate */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 shadow-xl">
          <div className="min-w-0 flex-1">
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
                Est. {formatUsd(minPerPerson)} – {formatUsd(maxPerPerson)} /
                person
                {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={requestDisabled || quoteMin == null}
            onClick={onRequestPay}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            Request & Pay
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* Bottom — target budget → Budget Planner */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
              Your Target Budget
            </p>
            <p className="mt-0.5 truncate text-xs font-bold text-white">
              {hasTarget
                ? `Target: ${formatUsd(customBudgetTarget)}`
                : "Have a specific budget?"}
            </p>
          </div>
          <Link
            href="/budget-planner"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/40 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
          >
            <span>
              {hasTarget ? "Edit Target" : "🎯 Set Target Budget"}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
