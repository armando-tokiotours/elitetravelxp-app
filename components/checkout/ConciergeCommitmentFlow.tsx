"use client";

import { useEffect, useState } from "react";
import {
  formatEstimateSubtext,
  loadConciergeEstimateCopy,
  perPersonPerDayEur,
  type ConciergeEstimateCopy,
  DEFAULT_CONCIERGE_ESTIMATE_COPY,
  DEFAULT_CONCIERGE_FEE_EUR,
} from "@/lib/conciergeEstimateFlow";
import { WidgetCallingPulse } from "@/components/branding/WidgetCallingPulse";
import { PandaFlexibleMascot } from "@/components/branding/PandaFlexibleMascot";

export type ConciergePathOption = "FULL" | "PARTIAL";

/**
 * Screen 1 — Estimated Trip Cost: per-person/day + three proceed options.
 * Used by Builder M / S / E.
 */
export function ConciergeCommitmentFlow({
  openEstimate,
  onCloseEstimate,
  totalPrice,
  paxCount,
  totalDays,
  onSelectPath,
  onSaveForLater,
  onSeeDetails,
}: {
  openEstimate: boolean;
  onCloseEstimate: () => void;
  totalPrice: number;
  paxCount: number;
  totalDays: number;
  onSelectPath: (path: ConciergePathOption) => void;
  onSaveForLater: () => void;
  /** Opens price composition / flexible breakdown */
  onSeeDetails?: () => void;
}) {
  const [copy, setCopy] = useState<ConciergeEstimateCopy>(
    DEFAULT_CONCIERGE_ESTIMATE_COPY
  );

  useEffect(() => {
    if (!openEstimate) return;
    void loadConciergeEstimateCopy().then(setCopy);
  }, [openEstimate]);

  useEffect(() => {
    if (!openEstimate) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openEstimate]);

  if (!openEstimate) return null;

  const pax = Math.max(1, paxCount);
  const days = Math.max(1, totalDays);
  const total = Math.max(0, totalPrice);
  const perDay = perPersonPerDayEur(total, pax, days);
  const sub = formatEstimateSubtext(copy.estimatePerDaySubtext, {
    pax,
    days,
    total,
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm no-print"
      role="presentation"
      onClick={onCloseEstimate}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="estimate-modal-title"
        className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {onSeeDetails ? (
          <button
            type="button"
            onClick={onSeeDetails}
            aria-label="See details and flexible price breakdown"
            className="relative z-[1] w-full space-y-2 overflow-visible rounded-2xl border border-white/70 bg-[#0D1117] p-5 text-center transition hover:border-[#F6A724]/60 animate-widget-call-glow"
          >
            <WidgetCallingPulse active roundedClass="rounded-2xl" />
            <span
              id="estimate-modal-title"
              className="relative z-10 block text-[10px] font-bold uppercase tracking-widest text-gray-400"
            >
              {copy.estimateModalTitle}
            </span>
            <div className="relative z-10 font-godiva text-3xl text-[#F6A724]">
              €{perDay}{" "}
              <span className="font-sans text-xs font-normal text-white">
                / PERSON / DAY
              </span>
            </div>
            <p className="relative z-10 text-[11px] text-gray-400">{sub}</p>
            <span className="relative z-10 mx-auto mt-2 block text-[10px] font-bold uppercase tracking-wider text-[#F6A724]">
              {copy.seeDetailsLabel}
            </span>
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
            <span
              id="estimate-modal-title"
              className="block text-[10px] font-bold uppercase tracking-widest text-gray-400"
            >
              {copy.estimateModalTitle}
            </span>
            <div className="font-godiva text-3xl text-[#F6A724]">
              €{perDay}{" "}
              <span className="font-sans text-xs font-normal text-white">
                / PERSON / DAY
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{sub}</p>
          </div>
        )}

        <div className="space-y-1 text-left">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            How would you like to proceed?
          </span>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelectPath("FULL")}
            className="group w-full space-y-1 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-left transition-all hover:border-[#075473] hover:bg-[#075473]/30"
          >
            <div className="text-sm font-bold text-white group-hover:text-[#F6A724]">
              {copy.optFullTitle}
            </div>
            <p className="text-xs text-white/85">{copy.optFullSub}</p>
            <div className="pt-0.5 text-[11px] font-semibold text-[#F6A724]">
              {copy.optFullHighlight}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectPath("PARTIAL")}
            className="group w-full space-y-1 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-left transition-all hover:border-[#075473] hover:bg-[#075473]/30"
          >
            <div className="text-sm font-bold text-white group-hover:text-[#F6A724]">
              {copy.optPartialTitle}
            </div>
            <p className="text-xs text-white/85">{copy.optPartialSub}</p>
            <div className="pt-0.5 text-[11px] font-semibold text-[#F6A724]">
              {copy.optPartialHighlight}
            </div>
          </button>

          <button
            type="button"
            onClick={onSaveForLater}
            className="group w-full space-y-1 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-left transition-all hover:bg-white/5"
          >
            <div className="text-sm font-bold text-gray-300 group-hover:text-white">
              {copy.optLaterTitle}
            </div>
            <p className="text-xs text-white/70">{copy.optLaterSub}</p>
          </button>
        </div>

        <button
          type="button"
          onClick={onCloseEstimate}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Screen 2 — Risk-free €60 deposit (100% credited). No non-refundable legalese.
 */
export function ConciergeFeeModal({
  open,
  onClose,
  onPay,
  feeAmountEur,
}: {
  open: boolean;
  onClose: () => void;
  onPay: () => void;
  feeAmountEur: number;
}) {
  const [copy, setCopy] = useState<ConciergeEstimateCopy>(
    DEFAULT_CONCIERGE_ESTIMATE_COPY
  );
  const [isAgreed, setIsAgreed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsAgreed(false);
    void loadConciergeEstimateCopy().then(setCopy);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const fee =
    feeAmountEur > 0
      ? feeAmountEur
      : copy.feeAmountEur || DEFAULT_CONCIERGE_FEE_EUR;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm no-print"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <PandaFlexibleMascot />
          <span className="block text-[10px] font-bold uppercase tracking-widest text-[#F6A724]">
            Risk-Free Reservation
          </span>
          <h2 className="font-godiva text-xl uppercase tracking-wide text-white">
            {copy.feeModalTitle}
          </h2>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-left">
          <p className="text-xs leading-relaxed text-gray-300">
            To hold your private guide and vehicle availability, a small{" "}
            <strong className="text-white">€{fee} Deposit</strong> is required
            today.
          </p>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-start gap-2 font-medium text-emerald-400">
              <span aria-hidden>✓</span>
              <span>
                <strong className="text-white">100% CREDITED:</strong> Applied
                directly to your final tour balance.
              </span>
            </div>
            <div className="flex items-start gap-2 font-medium text-emerald-400">
              <span aria-hidden>✓</span>
              <span>
                <strong className="text-white">100% FLEXIBLE:</strong> Change
                dates, routes, or stops anytime.
              </span>
            </div>
            <div className="flex items-start gap-2 font-medium text-emerald-400">
              <span aria-hidden>✓</span>
              <span>
                <strong className="text-white">ZERO RISK:</strong> Nothing is
                written in stone—we customize everything around your exact pace.
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAgreed((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left"
        >
          <input
            type="checkbox"
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded accent-[#075473]"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs font-medium text-gray-200">
            I&apos;m ready to hold my dates &amp; customize my tour
          </span>
        </button>

        <button
          type="button"
          disabled={!isAgreed}
          onClick={onPay}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-xs font-bold uppercase tracking-wider shadow-xl transition-all ${
            isAgreed
              ? "bg-[#075473] text-white shadow-[0_0_20px_rgba(7,84,115,0.6)] hover:bg-[#075473]/80 active:scale-[0.98]"
              : "cursor-not-allowed bg-gray-800 text-gray-500"
          }`}
        >
          Secure My Dates — Pay €{fee} Deposit →
        </button>

        <div className="flex items-center justify-center gap-2 font-mono text-[10px] text-gray-400">
          <span>🔒 Safe &amp; Encrypted Checkout</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Spec aliases — same screens. */
export { ConciergeCommitmentFlow as EstimatedCostModal };
export { ConciergeFeeModal as ConciergeDepositModal };
