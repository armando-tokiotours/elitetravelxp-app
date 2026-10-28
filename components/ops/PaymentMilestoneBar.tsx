"use client";

/**
 * Visual 30% deposit / 100% full payment bar from real ops_hub fields.
 * Uses total_paid_eur, estimated_total_eur, tour_payment_status (same sources as
 * classifyPaymentLane / ticketsMasterDesk / pnlLedger).
 */

import {
  detectPaymentDispatchThreshold,
  readPaymentDispatchFlags,
} from "@/lib/paymentDispatchFlags";
import {
  computeProgress30Target,
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import { deriveTourPaymentStatus } from "@/lib/tourPaymentStatus";

export type PaymentMilestoneHub = {
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  extras?: unknown;
};

export function PaymentMilestoneBar({
  hub,
  compact = false,
  className = "",
  surface = "dark",
}: {
  hub: PaymentMilestoneHub;
  compact?: boolean;
  className?: string;
  /** Cream list rows need darker badge text; dark is the default elsewhere */
  surface?: "dark" | "cream";
}) {
  const paid = roundEur(Number(hub.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  const status = deriveTourPaymentStatus(hub);
  const badge =
    packageTotal > 0 && paid > 0
      ? paymentBadgeForAmount(paid, packageTotal)
      : null;
  const progress30 =
    packageTotal > 0 ? computeProgress30Target(packageTotal) : 0;
  const pct =
    packageTotal > 0
      ? Math.min(100, Math.round((paid / packageTotal) * 100))
      : paid > 0
        ? status === "FULLY_PAID"
          ? 100
          : status === "PARTIALLY_PAID"
            ? 30
            : 8
        : 0;

  const threshold = detectPaymentDispatchThreshold({
    id: "",
    pnr: "",
    ...hub,
  });
  const flags = readPaymentDispatchFlags(hub.extras);
  const depositMet =
    threshold === "deposit_30" ||
    threshold === "full_100" ||
    Boolean(badge?.milestone30Met) ||
    status === "PARTIALLY_PAID" ||
    status === "FULLY_PAID";
  const fullMet =
    threshold === "full_100" ||
    Boolean(badge?.fullyPaid) ||
    status === "FULLY_PAID";

  const fillClass = fullMet
    ? "bg-emerald-500"
    : depositMet
      ? "bg-[#F6A724]"
      : paid > 0
        ? "bg-sky-500"
        : "bg-zinc-700";

  if (compact) {
    if (!depositMet && !fullMet) return null;
    const compactTone =
      surface === "cream"
        ? "border-emerald-700/40 bg-emerald-50 text-emerald-800"
        : "border-emerald-500/40 bg-emerald-500/20 text-emerald-400";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${compactTone} ${className}`}
        title={`Paid €${paid}${packageTotal > 0 ? ` / €${packageTotal}` : ""}`}
      >
        {fullMet ? "100% paid" : "30%+ deposit"}
        {flags.full_100 || flags.deposit_30 ? " · locked" : ""}
      </span>
    );
  }

  const feeMet =
    Boolean(hub.concierge_fee_paid) ||
    status === "FEE_PAID" ||
    depositMet ||
    fullMet;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-zinc-950/50 p-3 ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Payment milestones
          </p>
          <div className="flex flex-wrap gap-1.5">
            <MilestoneChip label="Fee" active={feeMet} />
            <MilestoneChip label="30% deposit" active={depositMet} />
            <MilestoneChip label="100% paid" active={fullMet} />
            {flags.deposit_30 ? (
              <MilestoneChip label="30% notified" active />
            ) : null}
            {flags.full_100 ? (
              <MilestoneChip label="100% notified" active />
            ) : null}
          </div>
        </div>
        <p className="font-mono text-[11px] text-zinc-300">
          €{paid.toLocaleString("en-US")}
          {packageTotal > 0
            ? ` / €${packageTotal.toLocaleString("en-US")} (${pct}%)`
            : ""}
        </p>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${fillClass}`}
          style={{ width: `${Math.max(pct, paid > 0 ? 4 : 0)}%` }}
        />
        {packageTotal > 0 && progress30 > 0 ? (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/40"
            style={{
              left: `${Math.min(99, Math.round((progress30 / packageTotal) * 100))}%`,
            }}
            title="30% deposit mark"
          />
        ) : null}
      </div>
    </div>
  );
}

function MilestoneChip({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  const toneClass = active
    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
    : "border-white/10 bg-gray-800 text-gray-400";
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${toneClass}`}
    >
      {label}
    </span>
  );
}
