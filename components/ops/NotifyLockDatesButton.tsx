"use client";

/**
 * Manual “Notify & Lock Dates” — fires payment dispatch for guide/driver email
 * + ticketer dashboard (idempotent unless force).
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

export function NotifyLockDatesButton({
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

  if (!threshold) {
    return (
      <p
        className={`flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500 ${className}`}
      >
        <span>Notify & Lock Dates unlocks after 30% deposit or full payment.</span>
        <span className="text-cyan-400" aria-hidden>
          /
        </span>
        <span>
          Bulk Journey Dispatch unlocks after 30% deposit or full payment.
        </span>
      </p>
    );
  }

  const label =
    threshold === "full_100" ? "Notify & Lock (100%)" : "Notify & Lock Dates";

  const run = async (force: boolean) => {
    if (isAliasReadOnly) {
      setMsg("Alias preview is read-only — exit disguise to notify.");
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
      };
      if (!res.ok) {
        setMsg(data.error || "Dispatch failed");
        return;
      }
      if (data.alreadySent && !force) {
        setMsg(data.message || "Already notified for this threshold.");
      } else {
        const bits = [
          data.guideEmailed ? "guide emailed" : null,
          data.driverEmailed ? "driver emailed" : null,
          data.ticketsUpdated ? "ticketer updated" : null,
        ].filter(Boolean);
        setMsg(
          bits.length
            ? `Sent: ${bits.join(" · ")}`
            : data.message || "Dispatch recorded."
        );
      }
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Dispatch failed");
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
          className="rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Sending…" : label}
        </button>
        {already ? (
          <button
            type="button"
            disabled={busy || isAliasReadOnly}
            onClick={() => void run(true)}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 disabled:opacity-40"
          >
            Re-send
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-[11px] text-zinc-400">{msg}</p> : null}
      {isAliasReadOnly ? (
        <p className="text-[10px] text-amber-400/90">
          Alias disguise is read-only for dispatch.
        </p>
      ) : null}
    </div>
  );
}
