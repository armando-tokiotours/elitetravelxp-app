"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  loadTickets,
  updateTicketsByPnr,
  type OpsTicketsRow,
} from "@/lib/opsTickets";
import { canAccessTicketer } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  OpsStatusBadge,
  loadOpsHub,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";

export function TicketerApp() {
  return (
    <StaffPortalShell title="Ticketer" allow={canAccessTicketer}>
      <TicketerInner />
    </StaffPortalShell>
  );
}

function TicketerInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);
  const [rows, setRows] = useState<OpsTicketsRow[]>([]);
  const [hubByPnr, setHubByPnr] = useState<Record<string, OpsHubRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const hubs = await loadOpsHub(pb);
      const map: Record<string, OpsHubRow> = {};
      for (const h of hubs) map[String(h.pnr).toUpperCase()] = h;
      setHubByPnr(map);

      let filter =
        'ticket_status="needed" || ticket_status="ordered" || ticket_status="done"';
      if (role === "ticketer" && staffId) {
        filter = `assigned_ticketer_id="${staffId}" || ticket_status="needed" || ticket_status="ordered"`;
      }
      setRows(await loadTickets(pb, filter));
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient, role, staffId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <p className="text-sm text-zinc-400">Loading tickets…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Tickets pocket (ops_tickets) per PNR. You do not see guide or driver
        pay.
      </p>
      {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No ticket jobs right now.
          </li>
        ) : (
          rows.map((row) => {
            const hub = hubByPnr[String(row.pnr).toUpperCase()];
            return (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-white">{row.pnr}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {hub?.primary_city || "—"} ·{" "}
                      {hub?.tour_date
                        ? String(hub.tour_date).slice(0, 10)
                        : "date TBD"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {hub?.guest_summary || "—"}
                    </p>
                  </div>
                  <OpsStatusBadge status={row.ticket_status} />
                </div>
                <textarea
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  rows={2}
                  defaultValue={row.ticket_notes || ""}
                  placeholder="Ticket notes (train / attraction / flight refs)"
                  onBlur={async (e) => {
                    const v = e.target.value;
                    if (v === (row.ticket_notes || "")) return;
                    try {
                      await updateTicketsByPnr(getClient(), row.pnr, {
                        ticket_notes: v,
                      });
                      setMsg(`Notes saved for ${row.pnr}`);
                      await reload();
                    } catch (err) {
                      setMsg(formatPbError(err));
                    }
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {["needed", "ordered", "done"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs capitalize text-zinc-300 hover:border-[#075473] hover:text-white"
                      onClick={async () => {
                        try {
                          await updateTicketsByPnr(getClient(), row.pnr, {
                            ticket_status: s as
                              | "needed"
                              | "ordered"
                              | "done",
                          });
                          setMsg(`${row.pnr} → ${s}`);
                          await reload();
                        } catch (err) {
                          setMsg(formatPbError(err));
                        }
                      }}
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
