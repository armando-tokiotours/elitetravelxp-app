"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatEstimateSummary, formatUsd } from "@/lib/builder-pricing";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import {
  CTA_PAY_BALANCE,
  paymentBadgeForAmount,
} from "@/lib/balanceSettlement";
import { CTA_SECURE_DEPOSIT } from "@/lib/tourPaymentStatus";
import { useBuilderStore } from "@/store/useBuilderStore";
import { ExplainerModal } from "./ExplainerModal";
import { DossierSectionOutline } from "@/components/builder/DossierSectionOutline";

export function PriceSummaryFooter({
  quoteMin,
  quoteMax,
  minPerPerson,
  maxPerPerson,
  totalGuests,
  onRequestPay,
  requestDisabled,
  /** sticky disabled — use placement="inline" in dossier; floating bar overlaps nav */
  placement = "inline",
  reserveLabel = CTA_SECURE_DEPOSIT,
  /** Same gate as Single — hide € until name/email/phone draft is saved */
  pricesUnlocked = true,
  amountPaidEur = 0,
  packageTotalEur = 0,
}: {
  quoteMin: number | null;
  quoteMax: number | null;
  minPerPerson: number | null;
  maxPerPerson: number | null;
  totalGuests: number;
  onRequestPay: () => void;
  requestDisabled?: boolean;
  /** sticky = fixed above bottom nav (hidden by default); inline = in-document glass cards */
  placement?: "sticky" | "inline";
  reserveLabel?: string;
  pricesUnlocked?: boolean;
  /** Ledger paid (fee + tour). Hide estimate/custom budget once money has landed. */
  amountPaidEur?: number;
  packageTotalEur?: number;
}) {
  const [conciergeVideoOpen, setConciergeVideoOpen] = useState(false);
  const customBudgetTarget = useBuilderStore((s) => s.customBudgetTarget);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const hasTarget = customBudgetTarget != null && customBudgetTarget > 0;
  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";
  const packageTotal =
    packageTotalEur > 0
      ? packageTotalEur
      : Math.max(quoteMax ?? 0, quoteMin ?? 0);
  const payBadge = paymentBadgeForAmount(amountPaidEur, packageTotal);
  /** Estimate + custom budget are pre-payment shopping only. */
  const showEstimateShop = payBadge.kind === "none";
  /** Fully paid → invoice is the source of truth; drop this section. */
  const hideBudgetSection = payBadge.fullyPaid;

  const zeroAddOns =
    !conciergeActive &&
    quoteMin != null &&
    quoteMax != null &&
    quoteMin <= 0 &&
    quoteMax <= 0;

  const totalLabel =
    quoteMin != null && quoteMax != null
      ? formatEstimateSummary({
          min: quoteMin,
          max: quoteMax,
          conciergeActive,
          conciergeFee: ELITE_CONCIERGE_FEE,
        })
      : "Calculating…";

  const perPersonPrimary =
    !pricesUnlocked
      ? "Est. —— / pax"
      : minPerPerson != null && maxPerPerson != null
        ? `${formatUsd(minPerPerson)} – ${formatUsd(maxPerPerson)} / pax`
        : totalLabel;

  const videoBanner = conciergeActive ? (
    <>
      <button
        type="button"
        onClick={() => setConciergeVideoOpen(true)}
        aria-label="Watch: How Your Dedicated Concierge Works"
        className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0A1017]/80 p-3 text-left shadow-2xl backdrop-blur-md transition hover:border-[#075473]/60"
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
  ) : null;

  const remainingGrid = hideBudgetSection ? null : (
    <div className="flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 p-3 shadow-2xl backdrop-blur-md sm:p-4">
      <div className="min-w-0">
        <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-white/50 sm:text-[10px]">
          {payBadge.kind === "progress30"
            ? "30% deposit secured"
            : "Fee credit applied"}
        </p>
        <p className="text-xs font-extrabold leading-tight text-white sm:text-lg">
          {formatUsd(payBadge.pendingBalance)} remaining
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-white/45 sm:text-[11px]">
          Paid {formatUsd(payBadge.amountPaid)}
          {payBadge.packageTotal > 0
            ? ` of ${formatUsd(payBadge.packageTotal)}`
            : ""}
          {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={requestDisabled}
        onClick={onRequestPay}
        className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-[#075473] px-2 py-2 text-center text-[10px] font-bold text-white transition hover:bg-[#096a91] disabled:opacity-60 sm:py-2.5 sm:text-xs"
      >
        {reserveLabel || CTA_PAY_BALANCE}
        <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
      </button>
    </div>
  );

  const budgetGrid = showEstimateShop ? (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
      <div className="flex w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 p-2.5 shadow-2xl backdrop-blur-md sm:p-4">
        <div className="min-w-0 overflow-hidden">
          <p className="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-white/50 sm:text-[10px]">
            Experience Japan Range
          </p>
          <p className="break-words text-xs font-extrabold leading-tight text-white sm:text-lg">
            {perPersonPrimary}
          </p>
          <p className="mt-0.5 break-words text-[9px] leading-snug text-white/45 sm:text-[11px]">
            {!pricesUnlocked ? (
              <>
                Save name &amp; email to unlock your estimate
                {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
              </>
            ) : zeroAddOns ? (
              "Self-arranged · add experiences for a range"
            ) : conciergeActive &&
              quoteMin != null &&
              quoteMax != null &&
              quoteMin === quoteMax &&
              quoteMin <= ELITE_CONCIERGE_FEE ? (
              "50€ deposit applied as direct credit toward confirmed bookings."
            ) : (
              <>
                {totalLabel}
                {totalGuests > 0 ? ` · ${totalGuests} guests` : ""}
                <br />
                {conciergeActive
                  ? "50€ deposit applied as direct credit toward confirmed bookings."
                  : "Selected options and experiences"}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={pricesUnlocked ? requestDisabled || quoteMin == null : false}
          onClick={onRequestPay}
          className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-[#075473] px-2 py-2 text-center text-[10px] font-bold text-white transition hover:bg-[#096a91] disabled:opacity-60 sm:py-2.5 sm:text-xs"
        >
          {pricesUnlocked ? reserveLabel : "Unlock estimate"}
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/80 p-2.5 shadow-2xl backdrop-blur-md sm:p-4">
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
          className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/5 px-2 py-2 text-center text-[10px] font-bold text-white transition hover:bg-white/10 sm:py-2.5 sm:text-xs"
        >
          <span>🎯 Set Budget</span>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  ) : (
    remainingGrid
  );

  const cards =
    placement === "inline" ? (
      <div className="flex w-full flex-col overflow-x-hidden">
        {videoBanner ? (
          <DossierSectionOutline label="Section 3: Concierge Video">
            {videoBanner}
          </DossierSectionOutline>
        ) : null}
        {hideBudgetSection ? null : (
          <DossierSectionOutline
            label={
              showEstimateShop
                ? "Section 4: Budget & Pay"
                : "Section 4: Remaining balance"
            }
          >
            {budgetGrid}
          </DossierSectionOutline>
        )}
      </div>
    ) : (
      <div className="flex w-full flex-col gap-2.5 overflow-x-hidden px-2 sm:px-4">
        {videoBanner}
        {hideBudgetSection ? null : budgetGrid}
      </div>
    );

  if (placement === "inline") {
    if (hideBudgetSection && !videoBanner) return null;
    return <div className="no-print w-full">{cards}</div>;
  }

  // Sticky float disabled — overlaps BottomNav / Section CTAs (IMG_4816)
  return null;
}
