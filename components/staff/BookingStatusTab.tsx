"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import {
  CANONICAL_STATUSES,
  toCanonicalStatus,
} from "@/lib/bookingStatus";
import { computeProgress30Target } from "@/lib/balanceSettlement";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { parseOpsHubExtras } from "@/lib/agentServices";
import { statusRequiresPayment } from "@/lib/paymentGate";
import type { OpsHubRow, StaffOption } from "@/components/staff/opsHubClient";
import { OpsPaymentStatusBadges } from "@/components/staff/OpsPaymentStatusBadges";
import {
  computeOpsFinancialAudit,
  resolveOpsRealBaseTotal,
} from "@/lib/opsFinancialAudit";
import { EditableInvoiceStudio } from "@/components/staff/EditableInvoiceStudio";
import { useTeamAuth } from "@/store/useTeamAuth";

export type TourPayStatusUi =
  | "UNPAID"
  | "FEE_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID";

export type BookingStatusSavePayload = {
  status: string;
  paymentConfirmed: boolean;
  tourPaymentStatus: TourPayStatusUi;
  assignedAgentId: string;
};

function deriveTourPayUi(row: OpsHubRow): TourPayStatusUi {
  const raw = String(row.tour_payment_status || "")
    .trim()
    .toUpperCase();
  if (
    raw === "UNPAID" ||
    raw === "FEE_PAID" ||
    raw === "PARTIALLY_PAID" ||
    raw === "FULLY_PAID"
  ) {
    return raw;
  }
  if (row.payment_confirmed) return "FULLY_PAID";
  if (row.concierge_fee_paid) return "FEE_PAID";
  return "UNPAID";
}

function formatEur(n: number): string {
  return `€${Math.round(n).toLocaleString("en-US")}`;
}

function statusLabel(status: string): string {
  return String(status || "")
    .trim()
    .replace(/_/g, " ");
}

/**
 * Financial override warnings when Ops sets a lifecycle status that
 * conflicts with amount paid. Maps unified names (quoted / deposit_paid /
 * fully_paid / confirmed) onto canonical dropdown values.
 */
function buildStatusFinancialWarning(opts: {
  pendingStatus: string;
  amountPaid: number;
  feeEur: number;
  milestone30Target: number;
  packageTotal: number;
}): string | null {
  const raw = String(opts.pendingStatus || "").trim();
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  const canonical = toCanonicalStatus(raw);
  const { amountPaid, feeEur, milestone30Target, packageTotal } = opts;

  // quoted / awaiting quote / PENDING_DEPOSIT → fee should be paid
  const impliesQuoted =
    canonical === "quoted" ||
    upper === "QUOTED" ||
    upper === "PENDING_DEPOSIT" ||
    upper === "PROCESSING";

  // deposit / 30% / RESERVED / DEPOSIT_PAID → canonical confirmed (reserved)
  const impliesDeposit30 =
    canonical === "confirmed" ||
    upper === "DEPOSIT_PAID" ||
    upper === "RESERVED";

  // fully paid / confirmed-complete → done / in_ops / FULLY_PAID
  const impliesFullyPaid =
    canonical === "done" ||
    canonical === "in_ops" ||
    upper === "FULLY_PAID" ||
    upper === "PENDING_BALANCE";

  if (impliesQuoted && amountPaid < feeEur) {
    return (
      `WARNING: Status implies quoted / awaiting deposit but the concierge fee ` +
      `(${formatEur(feeEur)}) is not paid (paid: ${formatEur(amountPaid)}).`
    );
  }

  if (
    impliesDeposit30 &&
    milestone30Target > 0 &&
    amountPaid < milestone30Target
  ) {
    return (
      `WARNING: Status implies 30% deposit / reserved but amount paid ` +
      `(${formatEur(amountPaid)}) has not reached the 30% milestone ` +
      `(${formatEur(milestone30Target)}).`
    );
  }

  if (
    impliesFullyPaid &&
    packageTotal > 0 &&
    amountPaid < packageTotal
  ) {
    return (
      `WARNING: Status implies fully paid / confirmed but amount paid ` +
      `(${formatEur(amountPaid)}) is less than the package total ` +
      `(${formatEur(packageTotal)}). Pending balance remains.`
    );
  }

  return null;
}

/**
 * Ops Tab 2 — financial audit + 30% progress milestone + concierge agent passport.
 */
export function BookingStatusTab({
  pb,
  row,
  agents,
  saving,
  isAgency = false,
  onSave,
}: {
  pb: PocketBase;
  row: OpsHubRow;
  agents: StaffOption[];
  saving: boolean;
  isAgency?: boolean;
  onSave: (payload: BookingStatusSavePayload) => void | Promise<void>;
}) {
  const [bookingStatus, setBookingStatus] = useState(row.status || "incoming");
  const [tourPay, setTourPay] = useState<TourPayStatusUi>(() =>
    deriveTourPayUi(row)
  );
  const [selectedAgentId, setSelectedAgentId] = useState(
    row.assigned_agent_id || ""
  );
  const [agentConfirmOpen, setAgentConfirmOpen] = useState(false);
  const [realBaseTotal, setRealBaseTotal] = useState(() =>
    Math.max(0, Math.round(Number(row.estimated_total_eur) || 0))
  );
  const [resolvingTotal, setResolvingTotal] = useState(
    !(Number(row.estimated_total_eur) > 0)
  );
  /** Healed from payments ledger when ops_hub.total_paid_eur is stale */
  const [healedTotalPaidEur, setHealedTotalPaidEur] = useState<number | null>(
    null
  );
  const staffRole = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);

  useEffect(() => {
    setBookingStatus(row.status || "incoming");
    setTourPay(deriveTourPayUi(row));
    setSelectedAgentId(row.assigned_agent_id || "");
    setAgentConfirmOpen(false);
    setHealedTotalPaidEur(null);
  }, [
    row.id,
    row.status,
    row.tour_payment_status,
    row.payment_confirmed,
    row.concierge_fee_paid,
    row.assigned_agent_id,
    row.total_paid_eur,
  ]);

  // Heal TOTAL PAID via admin concierge-fee GET (ledger sum → ops_hub).
  // Staff client PB rules can miss payments rows; this path uses admin API.
  useEffect(() => {
    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!pnr || !row.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/bookings/concierge-fee?pnr=${encodeURIComponent(pnr)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          totalPaidEur?: number;
          total_paid_eur?: number;
          amountPaid?: number;
        };
        const ledgerSum = Math.max(
          0,
          Math.round(
            Number(data.totalPaidEur) ||
              Number(data.amountPaid) ||
              Number(data.total_paid_eur) ||
              0
          )
        );
        if (cancelled) return;
        const hubPaid = Math.max(0, Math.round(Number(row.total_paid_eur) || 0));
        if (ledgerSum > hubPaid) {
          setHealedTotalPaidEur(ledgerSum);
        } else if (ledgerSum > 0) {
          setHealedTotalPaidEur(ledgerSum);
        }
      } catch {
        /* admin heal optional — fall back to hub field */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.id, row.pnr, row.total_paid_eur]);

  useEffect(() => {
    let cancelled = false;
    const cached = Math.max(0, Math.round(Number(row.estimated_total_eur) || 0));
    if (cached > 0) {
      setRealBaseTotal(cached);
      setResolvingTotal(false);
      return;
    }
    setResolvingTotal(true);
    void (async () => {
      try {
        const resolved = await resolveOpsRealBaseTotal(pb, row);
        if (cancelled) return;
        setRealBaseTotal(resolved);
        if (resolved > 0 && row.id) {
          // Cache on ops_hub so next open / payment ledger stays in sync
          void pb
            .collection("ops_hub")
            .update(
              row.id,
              { estimated_total_eur: resolved },
              { requestKey: null }
            )
            .catch(() => null);
        }
      } finally {
        if (!cancelled) setResolvingTotal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, row.id, row.pnr, row.estimated_total_eur, row.detail_id]);

  const conciergeFeePaid = Boolean(row.concierge_fee_paid);
  const conciergeFeeAmount = Math.round(
    Number(row.concierge_fee_amount) ||
      Number(row.deposit_amount) ||
      DEFAULT_CONCIERGE_FEE_EUR
  );
  const totalPaidEur = Math.round(
    Math.max(
      Number(row.total_paid_eur) || 0,
      healedTotalPaidEur || 0,
      conciergeFeePaid ? conciergeFeeAmount : 0
    )
  );

  const approvedPrice = Math.max(
    0,
    Math.round(Number(parseOpsHubExtras(row.extras).final_approved_price) || 0)
  );
  const packageTotal = Math.max(realBaseTotal, approvedPrice);
  const milestone30Target = computeProgress30Target(packageTotal);

  const audit = computeOpsFinancialAudit({
    realBaseTotal,
    conciergeFeePaid,
    conciergeFeeAmount,
    totalPaidEur,
  });

  const paymentConfirmed = tourPay === "FULLY_PAID";
  const savedStatus = row.status || "incoming";
  const statusDirty = bookingStatus !== savedStatus;
  const savedAgentId = row.assigned_agent_id || "";
  const agentDirty = selectedAgentId !== savedAgentId;
  const currentAgent = agents.find((a) => a.id === selectedAgentId);
  const pendingAgent = agents.find((a) => a.id === selectedAgentId);

  const confirmStatusPersist = (pending: string): boolean => {
    const warning = buildStatusFinancialWarning({
      pendingStatus: pending,
      amountPaid: totalPaidEur,
      feeEur: conciergeFeeAmount,
      milestone30Target,
      packageTotal,
    });
    const label = statusLabel(pending);
    const message = warning
      ? `${warning}\n\nAre you sure you want to OVERRIDE and save the status to '${label}'?`
      : `Are you sure you want to update the booking status to '${label}'?`;
    return window.confirm(message);
  };

  const persistBookingPayload = () => {
    void onSave({
      status: bookingStatus,
      paymentConfirmed,
      tourPaymentStatus: tourPay,
      assignedAgentId: selectedAgentId,
    });
  };

  const saveStatusOnly = () => {
    if (!statusDirty) return;
    if (!confirmStatusPersist(bookingStatus)) return;
    persistBookingPayload();
  };

  const cancelStatusEdit = () => {
    setBookingStatus(savedStatus);
  };

  const confirmSaveAgent = () => {
    if (statusDirty && !confirmStatusPersist(bookingStatus)) {
      setAgentConfirmOpen(false);
      return;
    }
    setAgentConfirmOpen(false);
    persistBookingPayload();
  };

  const saveAll = () => {
    if (statusDirty && !confirmStatusPersist(bookingStatus)) return;
    persistBookingPayload();
  };

  // Milestone-only pill — Fee/Tour pay already come from OpsPaymentStatusBadges
  const milestoneBadge =
    audit.isFullySettled
      ? null
      : audit.is30PercentThresholdMet
        ? {
            label: "30% PROGRESS PAID",
            className:
              "border-indigo-500/40 bg-indigo-500/20 text-indigo-300",
          }
        : null;

  return (
    <div className="max-w-4xl space-y-6 text-xs text-white">
      {/* Financial audit */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-sans text-sm font-semibold tracking-wider text-[#F6A724] uppercase">
            1. Financial &amp; payment audit
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <OpsPaymentStatusBadges row={row} />
            {milestoneBadge ? (
              <span
                className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${milestoneBadge.className}`}
              >
                {milestoneBadge.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3.5">
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Estimated total (base)
            </span>
            <div className="font-mono text-base font-bold text-white">
              {resolvingTotal && audit.realBaseTotal <= 0
                ? "…"
                : formatEur(audit.realBaseTotal)}
            </div>
            <span className="block text-[9px] text-gray-500">
              {audit.realBaseTotal > 0
                ? "Actual system net cost"
                : "No package total on PNR yet"}
            </span>
          </div>

          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3.5">
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Concierge deposit
            </span>
            <div
              className={`font-mono text-base font-bold ${
                audit.conciergeFeePaid ? "text-emerald-400" : "text-gray-500"
              }`}
            >
              {audit.conciergeFeePaid
                ? `${formatEur(audit.conciergeFeeAmount)} PAID ✓`
                : "€0"}
            </div>
            <span className="block text-[9px] text-gray-500">
              100% credited to balance
            </span>
          </div>

          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3.5">
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Total paid to date
            </span>
            <div className="font-mono text-base font-bold text-emerald-400">
              {formatEur(audit.totalPaidToDate)}
            </div>
            <span className="block text-[9px] text-emerald-500/80">
              Verified server receipts
            </span>
          </div>

          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3.5">
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Remaining due
            </span>
            <div className="font-mono text-base font-bold text-[#F6A724]">
              {formatEur(audit.remainingDue)}
            </div>
            <span className="block text-[9px] text-amber-500/80">
              {audit.realBaseTotal > 0
                ? "Pending balance"
                : "Awaiting package total"}
            </span>
          </div>
        </div>

        {/* 30% progress milestone */}
        <div className="mt-1 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
              30% Progress payment milestone
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                audit.is30PercentThresholdMet
                  ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "border border-amber-500/30 bg-amber-500/20 text-amber-300"
              }`}
            >
              {audit.is30PercentThresholdMet
                ? "MILESTONE REACHED ✓"
                : "ACTION REQUIRED"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <span className="block text-[10px] text-gray-400">
                30% progress target amount
              </span>
              <span className="font-mono font-bold text-white">
                {formatEur(audit.target30PercentAmount)}
              </span>
              <span className="block text-[9px] text-gray-500">
                (30% of {formatEur(audit.netAfterFee)} pending)
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400">
                Total needed for milestone
              </span>
              <span className="font-mono font-bold text-white">
                {formatEur(audit.totalNeededFor30Percent)}
              </span>
              <span className="block text-[9px] text-gray-500">
                (Deposit + 30% progress)
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400">
                Vendor dispatch lock
              </span>
              <span
                className={`text-[11px] font-bold ${
                  audit.is30PercentThresholdMet
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {audit.is30PercentThresholdMet
                  ? "Guides / drivers unlocked"
                  : "Hold vendor confirmation"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
          <div className="space-y-2">
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Overall booking status
            </label>
            <select
              value={bookingStatus}
              disabled={saving}
              onChange={(e) => setBookingStatus(e.target.value)}
              className={`w-full rounded-xl border bg-[#0A1017] px-3 py-2 text-white ${
                statusDirty
                  ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
                  : "border-white/10"
              }`}
            >
              {CANONICAL_STATUSES.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={!paymentConfirmed && statusRequiresPayment(s)}
                >
                  {s.replace(/_/g, " ")}
                  {!paymentConfirmed && statusRequiresPayment(s)
                    ? " (needs full tour pay)"
                    : ""}
                </option>
              ))}
            </select>
            {statusDirty ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveStatusOnly}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[11px] font-bold tracking-wider text-white uppercase shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  Save Status
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelStatusEdit}
                  className="flex-1 rounded-xl border border-white/15 bg-black/40 py-2.5 text-[11px] font-bold tracking-wider text-white uppercase transition hover:bg-white/5 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Tour payment status
            </label>
            <select
              value={tourPay}
              disabled={saving}
              onChange={(e) =>
                setTourPay(e.target.value as TourPayStatusUi)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0A1017] px-3 py-2 text-white"
            >
              <option value="UNPAID">Unpaid (no fee / no tour)</option>
              <option value="FEE_PAID">Fee paid (€60) — tour pending</option>
              <option value="PARTIALLY_PAID">30% progress deposit paid</option>
              <option value="FULLY_PAID">100% fully settled</option>
            </select>
          </div>
        </div>

        {!paymentConfirmed ? (
          <p className="text-[11px] text-amber-400/90">
            Golden rule: guide / driver / ticket purchase confirmations unlock
            for the guest only after Tour payment = Fully paid. Ops may release
            vendor holds after the 30% progress milestone above.
          </p>
        ) : null}
      </div>

      {/* Agent assignment */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="border-b border-white/10 pb-2 font-sans text-sm font-semibold tracking-wider text-cyan-300 uppercase">
          2. Assigned concierge agent
        </h2>

        {isAgency ? (
          <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
            Concierge · Ops (agency booking — agent assignment managed via
            agency desk)
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/50 p-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-gray-800">
                <span className="text-xl font-bold text-gray-400">
                  {currentAgent
                    ? (currentAgent.name || currentAgent.email || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()
                    : "?"}
                </span>
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                  {currentAgent ? "Assigned agent" : "Unassigned"}
                </div>
                <h3 className="truncate text-sm font-bold text-white uppercase">
                  {currentAgent
                    ? currentAgent.name || currentAgent.email
                    : "No agent assigned"}
                </h3>
                <p className="truncate text-[11px] text-gray-400">
                  {currentAgent
                    ? currentAgent.role || "Concierge specialist"
                    : "Select an agent from the dropdown"}
                </p>
                {currentAgent?.email ? (
                  <p className="truncate text-[10px] text-zinc-500">
                    {currentAgent.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">
                Assign / change concierge agent
              </label>
              <select
                value={selectedAgentId}
                disabled={saving}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setAgentConfirmOpen(false);
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0A1017] p-3 text-xs text-white"
              >
                <option value="">— Select agent —</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.email}
                    {agent.role ? ` (${agent.role})` : ""}
                  </option>
                ))}
              </select>
              {agentDirty ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setAgentConfirmOpen(true)}
                  className="w-full rounded-xl bg-[#075473] py-2.5 text-[11px] font-bold tracking-wider text-white uppercase transition hover:bg-[#075473]/80 disabled:opacity-40"
                >
                  Save agent assignment
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <EditableInvoiceStudio
        pb={pb}
        row={row}
        staffId={staffId}
        staffRole={staffRole}
        agentName={
          currentAgent?.name ||
          currentAgent?.email ||
          row.assigned_agent ||
          null
        }
        guestBaseTotalEur={realBaseTotal}
        onSaved={(services) => {
          void (async () => {
            try {
              const hub = await pb.collection("ops_hub").getOne<{
                estimated_total_eur?: number;
              }>(row.id, { requestKey: null });
              const next = Math.max(
                0,
                Math.round(Number(hub.estimated_total_eur) || 0)
              );
              if (next > 0) setRealBaseTotal(next);
            } catch {
              /* ignore */
            }
            void services;
          })();
        }}
      />

      {agentConfirmOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm agent save"
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/15 bg-[#0D1117] p-5 shadow-2xl"
          >
            <p className="text-sm font-semibold text-white">
              Do you want to save?
            </p>
            <p className="text-xs text-zinc-400">
              Assign{" "}
              <span className="font-semibold text-white">
                {pendingAgent?.name ||
                  pendingAgent?.email ||
                  "no agent (clear)"}
              </span>{" "}
              as concierge for this booking.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={confirmSaveAgent}
                className="flex-1 rounded-xl bg-[#075473] py-2.5 text-xs font-bold tracking-wider text-white uppercase disabled:opacity-40"
              >
                Yes
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setAgentConfirmOpen(false);
                  setSelectedAgentId(savedAgentId);
                }}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-bold tracking-wider text-white uppercase disabled:opacity-40"
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={saveAll}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#075473] py-4 text-xs font-bold tracking-wider text-white uppercase shadow-xl transition hover:bg-[#075473]/80 active:scale-[0.99] disabled:opacity-40"
        >
          {saving
            ? "Saving changes…"
            : "Save booking status & payment"}
        </button>
      </div>
    </div>
  );
}
