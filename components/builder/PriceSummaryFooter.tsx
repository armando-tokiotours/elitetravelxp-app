"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatEstimateSummary, formatUsd } from "@/lib/builder-pricing";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ExplainerModal } from "./ExplainerModal";

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
  const [conciergeVideoOpen, setConciergeVideoOpen] = useState(false);
  const customBudgetTarget = useBuilderStore((s) => s.customBudgetTarget);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const hasTarget = customBudgetTarget != null && customBudgetTarget > 0;
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

  const zeroAddOns =
    !conciergeActive &&
    quoteMin != null &&
    quoteMax != null &&
    quoteMin <= 0 &&
    quoteMax <= 0;

  const estimateLabel =
    quoteMin != null && quoteMax != null
      ? formatEstimateSummary({
          min: quoteMin,
          max: quoteMax,
          conciergeActive,
          conciergeFee: ELITE_CONCIERGE_FEE,
        })
      : "Calculating…";

  return (
    <div className="no-print sticky-action-bar fixed inset-x-0 bottom-16 z-30 mb-2 w-full overflow-x-hidden md:bottom-4 lg:left-16 lg:pl-0">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 overflow-x-hidden">
        {conciergeActive ? (
          <>
            <button
              type="button"
              onClick={() => setConciergeVideoOpen(true)}
              aria-label="Watch: How Your Dedicated Concierge Works"
              className="group mx-2 flex w-auto items-center gap-3 rounded-xl border border-[#075473]/50 bg-[#121212] p-3 text-left shadow-md transition hover:border-[#075473] sm:mx-4"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#075473] text-white shadow-lg transition-transform group-hover:scale-105"
                aria-hidden
              >
                <span className="ml-0.5 text-xs">▶</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#075473]">
                  ✨ Elite Concierge Service
                </span>
                <span className="block text-xs font-bold leading-tight text-white sm:text-sm">
                  Watch: How Your Dedicated Concierge Works
                </span>
                <span className="mt-0.5 block text-[10px] text-zinc-400">
                  Tap to play 1-min video explanation →
                </span>
              </span>
            </button>
            <ExplainerModal
              open={conciergeVideoOpen}
              onClose={() => setConciergeVideoOpen(false)}
              featureKey="elite_concierge"
            />
          </>
        ) : null}

        {/* Equal-width 50/50 dual grid — both cards always visible */}
        <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 px-2 py-2 sm:gap-4 sm:px-4 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
          {/* Card 1 — Experience Japan Range */}
          <div className="flex w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-xl border border-[#075473]/50 bg-[#1C1C1E] p-2.5 shadow-lg sm:p-4">
            <div className="min-w-0 overflow-hidden">
              <p className="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-[#075473] sm:text-[10px]">
                Experience Japan Range
              </p>
              <p className="break-words text-xs font-extrabold leading-tight text-white sm:text-lg">
                {estimateLabel}
              </p>
              <p className="mt-0.5 break-words text-[9px] leading-snug text-[#075473]/80 sm:text-[11px]">
                {zeroAddOns ? (
                  "Self-arranged · add experiences for a range"
                ) : conciergeActive &&
                  quoteMin != null &&
                  quoteMax != null &&
                  quoteMin === quoteMax &&
                  quoteMin <= ELITE_CONCIERGE_FEE ? (
                  `Design deposit · credited 100% toward your final trip`
                ) : minPerPerson != null && maxPerPerson != null ? (
                  <>
                    {formatUsd(minPerPerson)} – {formatUsd(maxPerPerson)} / pax
                    {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
                    <br />
                    {conciergeActive
                      ? "Elite Concierge design deposit included"
                      : "Selected options and experiences"}
                  </>
                ) : conciergeActive ? (
                  "Elite Concierge design deposit included"
                ) : (
                  "Selected options and experiences"
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={requestDisabled || quoteMin == null}
              onClick={onRequestPay}
              className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-[#075473] px-2 py-2 text-center text-[10px] font-bold text-[#121212] transition hover:bg-[#c9ab86] disabled:opacity-60 sm:py-2.5 sm:text-xs"
            >
              Request & Pay
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
            </button>
          </div>

          {/* Card 2 — Target budget (jet black) */}
          <div className="flex w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-xl border border-zinc-800 bg-[#121212] p-2.5 shadow-lg sm:p-4">
            <div className="min-w-0 overflow-hidden">
              <p className="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-zinc-400 sm:text-[10px]">
                Your Target Budget
              </p>
              <p className="break-words text-xs font-extrabold leading-tight text-white sm:text-lg">
                {hasTarget
                  ? `Target: ${formatUsd(customBudgetTarget)}`
                  : "Custom Budget"}
              </p>
              <p className="mt-0.5 break-words text-[9px] leading-snug text-zinc-400 sm:text-[11px]">
                Tailored plan options
              </p>
            </div>
            <Link
              href="/budget-planner"
              className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-[#1C1C1E] px-2 py-2 text-center text-[10px] font-bold text-white transition hover:bg-[#2C2C2E] sm:py-2.5 sm:text-xs"
            >
              <span>🎯 Set Budget</span>
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
