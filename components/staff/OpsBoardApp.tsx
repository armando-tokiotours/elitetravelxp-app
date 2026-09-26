"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  assignDriver,
  assignGuide,
  postDriverBoard,
  postGuideBoard,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import {
  loadTickets,
  updateTicketsByPnr,
  type OpsTicketsRow,
} from "@/lib/opsTickets";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  OpsStatusBadge,
  loadStaffByRole,
  useOpsHubList,
  type OpsHubRow,
  type StaffOption,
} from "@/components/staff/opsHubClient";

export function OpsBoardApp() {
  return (
    <StaffPortalShell title="Ops board" allow={canAccessOpsBoard}>
      <OpsBoardInner />
    </StaffPortalShell>
  );
}

function OpsBoardInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffId = useTeamAuth((s) => s.staffId);
  const { rows, loading, error, reload } = useOpsHubList(getClient);
  const [guides, setGuides] = useState<StaffOption[]>([]);
  const [drivers, setDrivers] = useState<StaffOption[]>([]);
  const [ticketers, setTicketers] = useState<StaffOption[]>([]);
  const [agents, setAgents] = useState<StaffOption[]>([]);
  const [dispatchByPnr, setDispatchByPnr] = useState<
    Record<string, OpsDispatchRow>
  >({});
  const [ticketsByPnr, setTicketsByPnr] = useState<
    Record<string, OpsTicketsRow>
  >({});
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reloadPockets = useCallback(async () => {
    const pb = getClient();
    try {
      const list = await pb.collection("ops_dispatch").getFullList<OpsDispatchRow>({
        requestKey: null,
      });
      const map: Record<string, OpsDispatchRow> = {};
      for (const d of list) map[String(d.pnr).toUpperCase()] = d;
      setDispatchByPnr(map);
    } catch {
      setDispatchByPnr({});
    }
    try {
      const list = await loadTickets(pb);
      const map: Record<string, OpsTicketsRow> = {};
      for (const t of list) map[String(t.pnr).toUpperCase()] = t;
      setTicketsByPnr(map);
    } catch {
      setTicketsByPnr({});
    }
  }, [getClient]);

  useEffect(() => {
    const pb = getClient();
    void (async () => {
      setGuides(await loadStaffByRole(pb, "guide"));
      setDrivers(await loadStaffByRole(pb, "driver"));
      setTicketers(await loadStaffByRole(pb, "ticketer"));
      setAgents(await loadStaffByRole(pb, "agent"));
      await reloadPockets();
    })();
  }, [getClient, reloadPockets]);

  const patchHub = async (
    id: string,
    data: Record<string, unknown>,
    okMsg: string
  ) => {
    setSavingId(id);
    setMsg(null);
    try {
      await getClient().collection("ops_hub").update(id, data, {
        requestKey: null,
      });
      setMsg(okMsg);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  const withSave = async (
    key: string,
    fn: () => Promise<void>,
    okMsg: string
  ) => {
    setSavingId(key);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await Promise.all([reload(), reloadPockets()]);
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading ops hub…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-400">
          Operations manager: assign concierge agent (direct), or assign
          guide/driver directly / post to job board. Tickets live in the tickets
          pocket. Money is on /ops/money.
        </p>
        <button
          type="button"
          onClick={() => void Promise.all([reload(), reloadPockets()])}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
        >
          Refresh
        </button>
      </div>
      {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">PNR</th>
              <th className="px-3 py-2">City / date</th>
              <th className="px-3 py-2">Guests</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Guide</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Ticketer</th>
              <th className="px-3 py-2">Tickets</th>
              <th className="px-3 py-2">Pickup notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  No ops_hub rows yet — create a builder booking first.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <OpsRow
                  key={row.id}
                  row={row}
                  dispatch={dispatchByPnr[String(row.pnr).toUpperCase()]}
                  tickets={ticketsByPnr[String(row.pnr).toUpperCase()]}
                  guides={guides}
                  drivers={drivers}
                  ticketers={ticketers}
                  agents={agents}
                  saving={savingId === row.id || savingId === row.pnr}
                  staffId={staffId}
                  pb={getClient()}
                  onPatchHub={patchHub}
                  onSave={withSave}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpsRow({
  row,
  dispatch,
  tickets,
  guides,
  drivers,
  ticketers,
  agents,
  saving,
  staffId,
  pb,
  onPatchHub,
  onSave,
}: {
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  tickets?: OpsTicketsRow;
  guides: StaffOption[];
  drivers: StaffOption[];
  ticketers: StaffOption[];
  agents: StaffOption[];
  saving: boolean;
  staffId: string | null;
  pb: PocketBase;
  onPatchHub: (
    id: string,
    data: Record<string, unknown>,
    okMsg: string
  ) => Promise<void>;
  onSave: (
    key: string,
    fn: () => Promise<void>,
    okMsg: string
  ) => Promise<void>;
}) {
  const guideId = dispatch?.assigned_guide_id || "";
  const driverId = dispatch?.assigned_driver_id || "";
  const guideMode = dispatch?.guide_mode || "unassigned";
  const driverMode = dispatch?.driver_mode || "unassigned";
  const guideBoard = Boolean(dispatch?.guide_board_visible);
  const driverBoard = Boolean(dispatch?.driver_board_visible);
  const ticketerId =
    tickets?.assigned_ticketer_id || row.assigned_ticketer_id || "";
  const ticketStatus =
    tickets?.ticket_status || row.ticket_status || "none";

  const guideLabel = useMemo(() => {
    if (guideBoard || guideMode === "open") return "Board open";
    if (guideMode === "claimed") return "Claimed";
    if (guideMode === "direct") return "Direct";
    return "—";
  }, [guideBoard, guideMode]);

  return (
    <tr className="border-b border-zinc-900/80 align-top">
      <td className="px-3 py-3 font-mono text-xs text-white">
        {row.pnr}
        <div className="mt-0.5 text-[10px] text-zinc-500">
          {row.source || "—"}
        </div>
      </td>
      <td className="px-3 py-3">
        <div>{row.primary_city || "—"}</div>
        <div className="text-xs text-zinc-500">
          {row.tour_date ? String(row.tour_date).slice(0, 10) : "—"}
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-zinc-400">
        {row.guest_summary || "—"}
      </td>
      <td className="px-3 py-3">
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={row.status || "incoming"}
          disabled={saving}
          onChange={(e) =>
            void onPatchHub(
              row.id,
              { status: e.target.value },
              `Status → ${e.target.value}`
            )
          }
        >
          {[
            "incoming",
            "quoted",
            "confirmed",
            "in_ops",
            "done",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        {row.source === "agency" ? (
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            Ops (agency)
          </span>
        ) : (
          <select
            className="max-w-[9rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={row.assigned_agent_id || ""}
            disabled={saving}
            onChange={(e) => {
              const id = e.target.value;
              const a = agents.find((x) => x.id === id);
              void onPatchHub(
                row.id,
                {
                  assigned_agent_id: id,
                  assigned_agent:
                    a?.name || a?.email || row.assigned_agent || "",
                },
                "Concierge agent assigned"
              );
            }}
          >
            <option value="">—</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1">
          <select
            className="max-w-[9rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={guideId}
            disabled={saving}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const g = guides.find((x) => x.id === id);
              void onSave(
                row.pnr,
                () =>
                  assignGuide(pb, {
                    pnr: row.pnr,
                    staffId: id,
                    staffName: g?.name || g?.email || "",
                    byStaffId: staffId || undefined,
                  }).then(() => undefined),
                "Guide assigned (direct)"
              );
            }}
          >
            <option value="">—</option>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || g.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving}
            className="block rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-white"
            onClick={() =>
              void onSave(
                row.pnr,
                () =>
                  postGuideBoard(pb, {
                    pnr: row.pnr,
                    byStaffId: staffId || undefined,
                  }).then(() => undefined),
                "Guide posted to job board"
              )
            }
          >
            Post to board
          </button>
          <span className="text-[10px] text-zinc-600">{guideLabel}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1">
          <select
            className="max-w-[9rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={driverId}
            disabled={saving}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const d = drivers.find((x) => x.id === id);
              void onSave(
                row.pnr,
                () =>
                  assignDriver(pb, {
                    pnr: row.pnr,
                    staffId: id,
                    staffName: d?.name || d?.email || "",
                    byStaffId: staffId || undefined,
                  }).then(() => undefined),
                "Driver assigned (direct)"
              );
            }}
          >
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving}
            className="block rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-white"
            onClick={() =>
              void onSave(
                row.pnr,
                () =>
                  postDriverBoard(pb, {
                    pnr: row.pnr,
                    byStaffId: staffId || undefined,
                  }).then(() => undefined),
                "Driver posted to job board"
              )
            }
          >
            Post to board
          </button>
          <span className="text-[10px] text-zinc-600">
            {driverBoard || driverMode === "open"
              ? "Board open"
              : driverMode === "claimed"
                ? "Claimed"
                : driverMode === "direct"
                  ? "Direct"
                  : "—"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <select
          className="max-w-[9rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={ticketerId}
          disabled={saving}
          onChange={(e) => {
            const id = e.target.value;
            void onSave(
              row.pnr,
              async () => {
                await updateTicketsByPnr(pb, row.pnr, {
                  assigned_ticketer_id: id,
                  ticket_status: id ? "needed" : "none",
                });
              },
              "Ticketer assigned"
            );
          }}
        >
          <option value="">—</option>
          {ticketers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || t.email}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          value={ticketStatus}
          disabled={saving}
          onChange={(e) =>
            void onSave(
              row.pnr,
              async () => {
                await updateTicketsByPnr(pb, row.pnr, {
                  ticket_status: e.target.value as
                    | "none"
                    | "needed"
                    | "ordered"
                    | "done",
                });
              },
              `Tickets → ${e.target.value}`
            )
          }
        >
          {["none", "needed", "ordered", "done"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <OpsStatusBadge status={ticketStatus} />
      </td>
      <td className="px-3 py-3">
        <textarea
          className="h-16 w-40 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          defaultValue={row.pickup_notes || ""}
          disabled={saving}
          onBlur={(e) => {
            const v = e.target.value;
            if (v === (row.pickup_notes || "")) return;
            void onPatchHub(row.id, { pickup_notes: v }, "Pickup notes saved");
          }}
        />
      </td>
    </tr>
  );
}
