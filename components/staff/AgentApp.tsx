"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { CANONICAL_STATUSES } from "@/lib/bookingStatus";
import {
  assertStatusAllowedWithPayment,
  coerceStatusWithPayment,
  statusRequiresPayment,
} from "@/lib/paymentGate";
import { canAccessAgent } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  OpsStatusBadge,
  useOpsHubList,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";

export function AgentApp() {
  return (
    <StaffPortalShell title="Concierge agent" allow={canAccessAgent}>
      <AgentInner />
    </StaffPortalShell>
  );
}

function AgentInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);
  const staffName = useTeamAuth((s) => s.email);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filterFn = useCallback(() => {
    if (role === "agent" && staffId) {
      return `assigned_agent_id="${staffId}" && source != "agency"`;
    }
    return `assigned_agent_id != "" && source != "agency"`;
  }, [role, staffId]);

  const { rows, loading, error, reload } = useOpsHubList(getClient, filterFn);

  const saveHub = async (
    row: OpsHubRow,
    patch: { payment_confirmed?: boolean; status?: string }
  ) => {
    setSavingId(row.id);
    setMsg(null);
    try {
      const paid =
        patch.payment_confirmed != null
          ? Boolean(patch.payment_confirmed)
          : Boolean(row.payment_confirmed);
      const nextStatus = coerceStatusWithPayment(
        patch.status || row.status,
        paid
      );
      if (patch.status) {
        assertStatusAllowedWithPayment(patch.status, paid);
      }
      const pb = getClient();
      await pb.collection("ops_hub").update(
        row.id,
        {
          ...patch,
          status: nextStatus,
          payment_confirmed: paid,
        },
        { requestKey: null }
      );
      if (nextStatus !== row.status) {
        const { syncDetailStatusFromOpsHub } = await import(
          "@/lib/syncOpsStatusToDetail"
        );
        await syncDetailStatusFromOpsHub(
          pb,
          { source: row.source, pnr: row.pnr },
          nextStatus
        );
      }
      setMsg(`Saved ${row.pnr}`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-400">
          Confirm payment, then set booking status. Guide / driver / ticket
          purchases only show confirmed to guests after payment is Yes.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/agent/draft"
            className="rounded-lg border border-[#F6A724]/40 bg-[#F6A724]/10 px-3 py-1.5 text-xs font-semibold text-[#F6A724]"
          >
            New draft link
          </a>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Refresh
          </button>
        </div>
      </div>
      {msg ? <p className="text-sm text-[#7ec8e3]">{msg}</p> : null}
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No assigned guest requests yet. Ops assigns you on the ops board.
          </li>
        ) : (
          rows.map((row) => (
            <AgentBookingCard
              key={row.id}
              row={row}
              saving={savingId === row.id}
              agentName={String(staffName || "Agent")}
              onSave={(patch) => void saveHub(row, patch)}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function AgentBookingCard({
  row,
  saving,
  agentName,
  onSave,
}: {
  row: OpsHubRow;
  saving: boolean;
  agentName: string;
  onSave: (patch: {
    payment_confirmed?: boolean;
    status?: string;
  }) => void;
}) {
  const [payment, setPayment] = useState(Boolean(row.payment_confirmed));
  const [status, setStatus] = useState(row.status || "incoming");

  useEffect(() => {
    setPayment(Boolean(row.payment_confirmed));
    setStatus(
      coerceStatusWithPayment(row.status, Boolean(row.payment_confirmed))
    );
  }, [row]);

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-white">{row.pnr}</p>
          <p className="mt-1 text-sm text-zinc-300">
            {row.primary_city || "—"} ·{" "}
            {row.tour_date ? String(row.tour_date).slice(0, 10) : "date TBD"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {row.guest_summary || "—"}
          </p>
        </div>
        <OpsStatusBadge status={row.status} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Payment confirmed
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
            value={payment ? "yes" : "no"}
            disabled={saving}
            onChange={(e) => setPayment(e.target.value === "yes")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Booking status
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
            value={status}
            disabled={saving || !payment}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CANONICAL_STATUSES.map((s) => (
              <option
                key={s}
                value={s}
                disabled={!payment && statusRequiresPayment(s)}
              >
                {s}
                {!payment && statusRequiresPayment(s) ? " (needs payment)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!payment ? (
        <p className="mt-1 text-[11px] text-amber-400/90">
          Confirm payment first — Confirmed status is blocked until Payment =
          Yes. Then guests can see guide / driver / ticket purchase.
        </p>
      ) : null}
      <button
        type="button"
        disabled={saving}
        className="mt-2 rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
        onClick={() =>
          onSave({
            payment_confirmed: payment,
            status: payment ? status : row.status,
          })
        }
      >
        {saving ? "Saving…" : "Save payment & status"}
      </button>

      <p className="mt-3 text-xs text-zinc-500">
        Guide: {row.assigned_guide || "—"} · Driver:{" "}
        {row.assigned_driver || "—"} · Tickets: {row.ticket_status || "none"}
      </p>
      <AgentCommThread pnr={row.pnr} agentName={agentName} />
    </li>
  );
}

function AgentCommThread({
  pnr,
  agentName,
}: {
  pnr: string;
  agentName: string;
}) {
  const [messages, setMessages] = useState<
    { id: string; author_role?: string; body: string }[]
  >([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/comm?pnr=${encodeURIComponent(pnr)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: { id: string; author_role?: string; body: string }[];
      };
      setMessages(data.messages || []);
    } catch {
      /* ignore */
    }
  }, [pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await fetch("/api/comm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr,
          body: text,
          authorRole: "agent",
          authorName: agentName,
        }),
      });
      setDraft("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
      <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
        Comm hub
      </p>
      <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No guest messages yet.</p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="text-[11px] text-zinc-300">
              <span className="text-zinc-500 uppercase">
                {m.author_role}:{" "}
              </span>
              {m.body}
            </p>
          ))
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white"
          placeholder="Reply to guest…"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void send()}
          className="rounded bg-[#075473] px-3 py-1 text-[10px] font-bold text-white uppercase disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
