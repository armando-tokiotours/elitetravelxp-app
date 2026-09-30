"use client";

import { useCallback, useEffect, useState } from "react";
import { canAccessAgent } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { OpsStatusBadge, useOpsHubList } from "@/components/staff/opsHubClient";

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

  const filterFn = useCallback(() => {
    if (role === "agent" && staffId) {
      return `assigned_agent_id="${staffId}" && source != "agency"`;
    }
    return `assigned_agent_id != "" && source != "agency"`;
  }, [role, staffId]);

  const { rows, loading, error, reload } = useOpsHubList(getClient, filterFn);

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-400">
          Your direct-guest requests and Comm hub inbox. Agency trips stay with
          Operations.
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          Refresh
        </button>
      </div>
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No assigned guest requests yet. Ops assigns you on the ops board.
          </li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-white">{row.pnr}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {row.primary_city || "—"} ·{" "}
                    {row.tour_date
                      ? String(row.tour_date).slice(0, 10)
                      : "date TBD"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.guest_summary || "—"}
                  </p>
                </div>
                <OpsStatusBadge status={row.status} />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Guide: {row.assigned_guide || "—"} · Driver:{" "}
                {row.assigned_driver || "—"} · Tickets:{" "}
                {row.ticket_status || "none"}
              </p>
              <AgentCommThread
                pnr={row.pnr}
                agentName={String(staffName || "Agent")}
              />
            </li>
          ))
        )}
      </ul>
    </div>
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
