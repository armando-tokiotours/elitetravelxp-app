"use client";

import { useCallback } from "react";
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

  const filterFn = useCallback(() => {
    if (role === "agent" && staffId) {
      return `assigned_agent_id="${staffId}" && source != "agency"`;
    }
    // owner/ops preview: direct bookings with an agent
    return `assigned_agent_id != "" && source != "agency"`;
  }, [role, staffId]);

  const { rows, loading, error, reload } = useOpsHubList(getClient, filterFn);

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-400">
          Your direct-guest requests. You are the face-to-client contact —
          coordinate the booking. Agency trips are handled by Operations.
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
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
