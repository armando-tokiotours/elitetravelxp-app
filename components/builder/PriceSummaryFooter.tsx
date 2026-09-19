"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { formatUsd } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { CustomBudgetModal } from "@/components/builder/modals/CustomBudgetModal";

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
  const setCustomBudgetTarget = useBuilderStore((s) => s.setCustomBudgetTarget);
  const [budgetOpen, setBudgetOpen] = useState(false);

  return (
    <>
      <div className="no-print sticky-action-bar fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 md:bottom-4 md:pl-16">
        <div className="mx-auto mb-16 grid w-full max-w-5xl grid-cols-1 gap-3 md:mb-0 md:grid-cols-2 md:gap-4">
          {/* Card 1 — Calculated estimate */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Experience Japan Range
              </p>
              <p className="mt-0.5 truncate font-display text-lg leading-tight text-white sm:text-xl">
                {quoteMin != null && quoteMax != null
                  ? `Est. ${formatUsd(quoteMin)} – ${formatUsd(quoteMax)}`
                  : "Calculating…"}
              </p>
              {minPerPerson != null && maxPerPerson != null ? (
                <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                  Est. {formatUsd(minPerPerson)} – {formatUsd(maxPerPerson)} per
                  person
                  {totalGuests > 1 ? ` · ${totalGuests} guests` : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={requestDisabled || quoteMin == null}
              onClick={onRequestPay}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60 sm:px-5 sm:py-3"
            >
              Request & Pay
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Card 2 — Custom budget matcher */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-zinc-950 p-4 shadow-xl">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Your Target Budget
              </p>
              {customBudgetTarget != null && customBudgetTarget > 0 ? (
                <>
                  <p className="mt-0.5 truncate font-display text-lg leading-tight text-white sm:text-xl">
                    Target Budget: {formatUsd(customBudgetTarget)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                    Matching in Progress · our team will tailor options
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 font-display text-lg leading-tight text-white sm:text-xl">
                    Have a specific budget in mind?
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                    Tell us your target amount and our team will suggest
                    optimized itinerary options.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setBudgetOpen(true)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-amber-500/40 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
            >
              <span>
                {customBudgetTarget != null && customBudgetTarget > 0
                  ? "Edit Target"
                  : "🎯 Set Target Budget"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <CustomBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        initialValue={customBudgetTarget}
        onSubmit={(amount) => setCustomBudgetTarget(amount)}
      />
    </>
  );
}
