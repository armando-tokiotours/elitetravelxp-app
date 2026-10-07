"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatEur } from "@/lib/singleDayPricing";
import {
  computeBalanceOptions,
  type BalancePayOption,
} from "@/lib/balanceSettlement";
import { ActionPillButton } from "@/components/ui/ActionPillButton";
import { PandaFlexibleMascot } from "@/components/branding/PandaFlexibleMascot";

/**
 * Settle tour balance from PocketBase amountPaid (totalPaidEur).
 * 30% option only while amountPaid < 30% of package; then remaining only.
 */
export function BalancePaymentModal({
  open,
  onClose,
  pnr,
  guestName,
  totalPackageEur,
  conciergeCreditEur,
  totalPaidEur,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  pnr: string;
  guestName?: string;
  totalPackageEur: number;
  conciergeCreditEur: number;
  /** Single source of truth — ops_hub.total_paid_eur */
  totalPaidEur?: number;
  onConfirm: (option: BalancePayOption, amountEur: number) => void;
}) {
  const math = computeBalanceOptions({
    packageTotalEur: totalPackageEur,
    conciergeCreditEur,
    totalPaidEur,
  });

  const [selected, setSelected] = useState<BalancePayOption>(
    math.show30Percent ? "30_PERCENT" : "FULL"
  );

  useEffect(() => {
    if (!open) return;
    setSelected(math.show30Percent ? "30_PERCENT" : "FULL");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, math.show30Percent]);

  if (!open) return null;

  const payAmount = math.show30Percent
    ? selected === "30_PERCENT"
      ? math.progress30Due
      : math.pendingBalance
    : math.pendingBalance;

  if (!(math.pendingBalance > 0)) {
    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0A1017] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-emerald-300">
            ✓ Your trip is 100% fully paid. No further action required.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-[#075473] py-3 text-xs font-bold uppercase tracking-wider text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settle tour balance"
        className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3 sm:gap-3">
          <div className="min-w-0 flex-1">
            {guestName?.trim() ? (
              <p className="text-sm font-bold tracking-wide text-white">
                {guestName.trim()}
              </p>
            ) : null}
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.2em] text-[#F6A724] ${
                guestName?.trim() ? "mt-1" : ""
              }`}
            >
              Settle tour balance
            </p>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">Ref {pnr}</p>
          </div>
          <PandaFlexibleMascot
            size="sm"
            characterSrc="/brand/panda-balance.png"
            className="!mx-0 !min-h-0 !w-auto !max-w-[7rem] shrink-0 sm:!max-w-[8.5rem]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-xs">
          <div className="flex justify-between gap-3 text-zinc-400">
            <span>Package total</span>
            <span className="font-mono font-semibold text-white">
              {formatEur(math.packageTotal)}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-emerald-400">
            <span>Already paid</span>
            <span className="font-mono">− {formatEur(math.totalPaid)}</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Total payments received so far
            {math.progress30Met
              ? ` · 30% milestone met (${formatEur(math.progress30Target)})`
              : math.credit > 0
                ? ` · includes fee credit toward ${formatEur(math.progress30Target)} (30%)`
                : ""}
          </p>
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-sm font-bold text-white">
            <span>Pending balance</span>
            <span className="font-mono text-[#F6A724]">
              {formatEur(math.pendingBalance)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Select payment amount
          </p>

          {math.show30Percent ? (
            <button
              type="button"
              onClick={() => setSelected("30_PERCENT")}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                selected === "30_PERCENT"
                  ? "border-[#075473] bg-[#075473]/30 shadow-lg"
                  : "border-white/10 bg-[#0D1117] hover:bg-white/5"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-white">
                  Finish 30% progress
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  Fee already counted · lock guides &amp; vendors
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-base font-bold text-[#F6A724]">
                  {formatEur(math.progress30Due)}
                </p>
                <p className="text-[9px] text-zinc-500">
                  Rest due 14 days before trip
                </p>
              </div>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setSelected("FULL")}
            className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
              selected === "FULL" || !math.show30Percent
                ? "border-[#075473] bg-[#075473]/30 shadow-lg"
                : "border-white/10 bg-[#0D1117] hover:bg-white/5"
            }`}
          >
            <div>
              <p className="text-xs font-bold text-white">
                {math.show30Percent
                  ? "100% full settlement"
                  : "Pay remaining balance"}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                Settle complete trip in full
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-bold text-emerald-400">
                {formatEur(math.pendingBalance)}
              </p>
              <p className="text-[9px] text-emerald-500/80">Fully paid status</p>
            </div>
          </button>
        </div>

        <ActionPillButton
          label={`Pay ${formatEur(payAmount)} via encrypted checkout`}
          disabled={!(payAmount > 0)}
          onClick={() =>
            onConfirm(
              math.show30Percent && selected === "30_PERCENT"
                ? "30_PERCENT"
                : "FULL",
              payAmount
            )
          }
          className="w-full"
        />
      </div>
    </div>
  );
}
