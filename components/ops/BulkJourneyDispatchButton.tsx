"use client";

/**
 * 1-click bulk Notify & Lock for all assigned guides/drivers/ticketers
 * on a multi-day PNR. Reuses /api/ops/payment-dispatch with scope=bulk.
 * Gated by 30%+ payment (same threshold as NotifyLockDatesButton).
 */

import { useState } from "react";
import type PocketBase from "pocketbase";
import {
  detectPaymentDispatchThreshold,
  readPaymentDispatchFlags,
} from "@/lib/paymentDispatchFlags";
import type { PaymentMilestoneHub } from "@/components/ops/PaymentMilestoneBar";
import { useAliasSession } from "@/components/ops/useAliasSession";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

export function BulkJourneyDispatchButton({
  pnr,
  hub,
  pb: _pb,
  onDone,
  className = "",
}: {
  pnr: string;
  hub: PaymentMilestoneHub;
  pb?: PocketBase;
  onDone?: () => void;
  className?: string;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const { alias } = useAliasSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isAliasReadOnly =
    canAccessOpsBoard(role) &&
    !!alias &&
    (alias.roleType === "guide" ||
      alias.roleType === "driver" ||
      alias.roleType === "agency");

  const threshold = detectPaymentDispatchThreshold({
    id: "",
    pnr,
    ...hub,
  });
  const flags = readPaymentDispatchFlags(hub.extras);
  const already =
    (threshold === "deposit_30" && Boolean(flags.deposit_30)) ||
    (threshold === "full_100" && Boolean(flags.full_100));

  // Locked helper is combined into NotifyLockDatesButton (same gate).
  if (!threshold) return null;

  const run = async (force: boolean) => {
    if (isAliasReadOnly) {
      setMsg("Alias preview is read-only — exit disguise to dispatch.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const token = getClient().authStore.token;
      const res = await fetch("/api/ops/payment-dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pnr,
          force,
          threshold: "auto",
          scope: "bulk",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadySent?: boolean;
        message?: string;
        error?: string;
        guideEmailed?: boolean;
        driverEmailed?: boolean;
        ticketsUpdated?: boolean;
        guidesEmailedCount?: number;
        driversEmailedCount?: number;
      };
      if (!res.ok) {
        setMsg(data.error || "Bulk dispatch failed");
        return;
      }
      if (data.alreadySent && !force) {
        setMsg(data.message || "Already notified for this threshold.");
      } else {
        const bits = [
          typeof data.guidesEmailedCount === "number"
            ? `${data.guidesEmailedCount} guide(s)`
            : data.guideEmailed
              ? "guide emailed"
              : null,
          typeof data.driversEmailedCount === "number"
            ? `${data.driversEmailedCount} driver(s)`
            : data.driverEmailed
              ? "driver emailed"
              : null,
          data.ticketsUpdated ? "ticketer updated" : null,
        ].filter(Boolean);
        setMsg(
          bits.length
            ? `Bulk sent: ${bits.join(" · ")}`
            : data.message || "Bulk dispatch recorded."
        );
      }
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Bulk dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || isAliasReadOnly}
          onClick={() => void run(false)}
          className="rounded-lg border border-[#F6A724]/50 bg-[#F6A724]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F6A724] disabled:opacity-40"
        >
          {busy ? "Sending…" : "Bulk Journey Dispatch"}
        </button>
        {already ? (
          <button
            type="button"
            disabled={busy || isAliasReadOnly}
            onClick={() => void run(true)}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 disabled:opacity-40"
          >
            Re-send bulk
          </button>
        ) : null}
      </div>
      <p className="text-[10px] text-zinc-500">
        Emails every assigned guide day-job and driver leg for this PNR; sets
        ticketer to proceed-to-purchase. Same 30%+ gate and idempotent flags.
      </p>
      {msg ? <p className="text-[11px] text-zinc-400">{msg}</p> : null}
      {isAliasReadOnly ? (
        <p className="text-[10px] text-amber-400/90">
          Alias disguise is read-only for dispatch.
        </p>
      ) : null}
    </div>
  );
}
