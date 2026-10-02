"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import {
  DEFAULT_CONCIERGE_FEE_EUR,
  loadConciergeEstimateCopy,
  type ConciergeEstimateCopy,
  DEFAULT_CONCIERGE_ESTIMATE_COPY,
} from "@/lib/conciergeEstimateFlow";

type FlipFace = null | "budget" | "agent";

/**
 * After Estimate → “Save for Later”:
 * - Budget flips to CTA → Budget Planner
 * - 1:1 agent flips to €60 fee + Pay (no mailto) — agent assigned after payment
 */
export function SaveForLaterOptionsModal({
  open,
  onClose,
  onPayFee,
  onContinueEditing,
  feeAmountEur,
  budgetHref = "/budget-planner",
}: {
  open: boolean;
  onClose: () => void;
  onPayFee: () => void;
  onContinueEditing: () => void;
  feeAmountEur?: number;
  budgetHref?: string;
}) {
  const [copy, setCopy] = useState<ConciergeEstimateCopy>(
    DEFAULT_CONCIERGE_ESTIMATE_COPY
  );
  const [flipped, setFlipped] = useState<FlipFace>(null);

  useEffect(() => {
    if (!open) return;
    setFlipped(null);
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
    feeAmountEur && feeAmountEur > 0
      ? feeAmountEur
      : copy.feeAmountEur || DEFAULT_CONCIERGE_FEE_EUR;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm no-print"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save for later options"
        className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#0A1017] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F6A724]">
              Save for later
            </p>
            <h3 className="mt-1 font-godiva text-xl uppercase tracking-wide text-white">
              What would you like next?
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Budget flip card */}
        <div className="relative min-h-[5.5rem]">
          {flipped === "budget" ? (
            <div className="rounded-xl border border-[#F6A724]/45 bg-[#F6A724]/10 p-3.5">
              <p className="text-sm font-bold text-[#F6A724]">
                Open Budget Planner
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Shape a spend target that fits your trip, then return anytime.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFlipped(null)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
                >
                  Back
                </button>
                <Link
                  href={budgetHref}
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#075473] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#054F70]"
                >
                  Go to Budget Planner
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped("budget")}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:border-[#F6A724]/50 hover:bg-white/10"
            >
              <p className="text-sm font-bold text-white">
                Set up your own Budget
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Open Budget Planner and shape a spend target that fits your
                trip.
              </p>
            </button>
          )}
        </div>

        {/* 1:1 agent → fee + pay flip (no mailto) */}
        <div className="relative min-h-[5.5rem]">
          {flipped === "agent" ? (
            <div className="rounded-xl border border-[#F6A724]/45 bg-[#F6A724]/10 p-3.5">
              <p className="text-sm font-bold text-[#F6A724]">
                €{fee} Deposit (100% credited)
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                To hold your private guide and vehicle availability, a small €
                {fee} Deposit is required today. It is 100% credited toward your
                final tour balance. 100% flexible — change dates, routes, or
                stops anytime. After payment, an agent is assigned so you can
                talk by email or chat.
              </p>
              <p className="mt-2 text-[10px] text-zinc-500">
                After payment an agent is assigned — then you can start talking
                by email or beBubble.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFlipped(null)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPayFee();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#075473] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#054F70]"
                >
                  Secure My Dates — Pay €{fee} Deposit →
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped("agent")}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:border-[#075473]/60 hover:bg-white/10"
            >
              <p className="text-sm font-bold text-white">1:1 contact agent</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Message a TokioTours specialist — pay the concierge fee, then an
                agent is assigned.
              </p>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onContinueEditing();
          }}
          className="w-full rounded-xl border border-white/15 bg-transparent py-3 text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/5"
        >
          ← Continue editing
        </button>
      </div>
    </div>
  );
}
