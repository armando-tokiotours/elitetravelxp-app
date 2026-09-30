"use client";

import { useCallback, useEffect, useState } from "react";
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

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          No ops_hub rows yet — create a builder booking first.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <OpsCard
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
              onSave={withSave}
              onReloadPockets={reloadPockets}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OpsCard({
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
  onSave,
  onReloadPockets,
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
  onSave: (
    key: string,
    fn: () => Promise<void>,
    okMsg: string
  ) => Promise<void>;
  onReloadPockets: () => Promise<void>;
}) {
  const [status, setStatus] = useState(row.status || "incoming");
  const [paymentConfirmed, setPaymentConfirmed] = useState(
    Boolean(row.payment_confirmed)
  );
  const [agentId, setAgentId] = useState(row.assigned_agent_id || "");
  const [guideId, setGuideId] = useState(dispatch?.assigned_guide_id || "");
  const [driverId, setDriverId] = useState(dispatch?.assigned_driver_id || "");
  const [ticketerId, setTicketerId] = useState(
    tickets?.assigned_ticketer_id || row.assigned_ticketer_id || ""
  );
  const [ticketStatus, setTicketStatus] = useState(
    tickets?.ticket_status || row.ticket_status || "none"
  );
  const [pickupNotes, setPickupNotes] = useState(row.pickup_notes || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setStatus(row.status || "incoming");
    setPaymentConfirmed(Boolean(row.payment_confirmed));
    setAgentId(row.assigned_agent_id || "");
    setGuideId(dispatch?.assigned_guide_id || "");
    setDriverId(dispatch?.assigned_driver_id || "");
    setTicketerId(
      tickets?.assigned_ticketer_id || row.assigned_ticketer_id || ""
    );
    setTicketStatus(tickets?.ticket_status || row.ticket_status || "none");
    setPickupNotes(row.pickup_notes || "");
    setDirty(false);
  }, [row, dispatch, tickets]);

  const guideMode = dispatch?.guide_mode || "unassigned";
  const driverMode = dispatch?.driver_mode || "unassigned";
  const guideBoard = Boolean(dispatch?.guide_board_visible);
  const driverBoard = Boolean(dispatch?.driver_board_visible);
  const ticketsNeeded =
    row.tickets_needed === true ||
    ticketStatus === "needed" ||
    ticketStatus === "ordered" ||
    ticketStatus === "done";
  const driverNeeded =
    row.driver_needed === true ||
    dispatch?.driver_needed === true ||
    Boolean(driverId) ||
    Boolean(dispatch?.assigned_driver_id);
  const guideNeeded =
    row.guide_needed === true ||
    dispatch?.guide_needed === true ||
    Boolean(guideId) ||
    Boolean(dispatch?.assigned_guide_id);

  const ticketLines = Array.isArray(tickets?.ticket_lines)
    ? (tickets?.ticket_lines as { name?: string; qty?: number }[])
    : [];

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const persistCard = async () => {
    const agent = agents.find((x) => x.id === agentId);
    await pb.collection("ops_hub").update(
      row.id,
      {
        status,
        payment_confirmed: paymentConfirmed,
        assigned_agent_id: agentId,
        assigned_agent: agent?.name || agent?.email || row.assigned_agent || "",
        pickup_notes: pickupNotes,
      },
      { requestKey: null }
    );
    if (typeof status === "string" && status !== row.status) {
      const { syncDetailStatusFromOpsHub } = await import(
        "@/lib/syncOpsStatusToDetail"
      );
      await syncDetailStatusFromOpsHub(
        pb,
        {
          source: row.source,
          pnr: row.pnr,
        },
        status
      );
    }
    if (guideId && guideId !== (dispatch?.assigned_guide_id || "")) {
      const g = guides.find((x) => x.id === guideId);
      await assignGuide(pb, {
        pnr: row.pnr,
        staffId: guideId,
        staffName: g?.name || g?.email || "",
        byStaffId: staffId || undefined,
      });
    }
    if (driverId && driverId !== (dispatch?.assigned_driver_id || "")) {
      const d = drivers.find((x) => x.id === driverId);
      await assignDriver(pb, {
        pnr: row.pnr,
        staffId: driverId,
        staffName: d?.name || d?.email || "",
        byStaffId: staffId || undefined,
      });
    }
    await updateTicketsByPnr(pb, row.pnr, {
      assigned_ticketer_id: ticketerId,
      ticket_status: ticketStatus as "none" | "needed" | "ordered" | "done",
    });
    setDirty(false);
    await onReloadPockets();
  };

  const saveThen = async (after?: () => Promise<void>, okMsg = "Card saved") => {
    await onSave(row.id, async () => {
      await persistCard();
      if (after) await after();
    }, okMsg);
  };

  return (
    <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-semibold text-white">{row.pnr}</p>
            <p className="mt-0.5 text-sm text-zinc-300">
              {row.primary_city || "—"} ·{" "}
              {row.tour_date ? String(row.tour_date).slice(0, 10) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {row.guest_summary || "—"} · {row.source || "direct"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {guideNeeded ? (
              <span className="rounded-full border border-[#075473]/40 bg-[#075473]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#7ec8e3]">
                Guide
              </span>
            ) : null}
            {driverNeeded ? (
              <span className="rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#F6A724]">
                Driver
              </span>
            ) : null}
            {ticketsNeeded ? (
              <span className="rounded-full border border-[#1BA58A]/40 bg-[#1BA58A]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#1BA58A]">
                Tickets
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              value={status}
              disabled={saving}
              onChange={(e) => mark(setStatus)(e.target.value)}
            >
              {[
                "draft",
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
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Payment confirmed
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              value={paymentConfirmed ? "yes" : "no"}
              disabled={saving}
              onChange={(e) => mark(setPaymentConfirmed)(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          {row.source === "agency" ? (
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 sm:col-span-2">
              Concierge · Ops (agency)
            </p>
          ) : (
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:col-span-2">
              Concierge agent
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                value={agentId}
                disabled={saving}
                onChange={(e) => mark(setAgentId)(e.target.value)}
              >
                <option value="">—</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {guideNeeded ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Guide · {guideBoard || guideMode === "open" ? "Board open" : guideMode === "claimed" ? "Claimed" : guideMode === "direct" ? "Direct" : "Unassigned"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                className="min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={guideId}
                disabled={saving}
                onChange={(e) => mark(setGuideId)(e.target.value)}
              >
                <option value="">Assign direct…</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name || g.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 hover:text-white disabled:opacity-40"
                onClick={() =>
                  void saveThen(
                    () =>
                      postGuideBoard(pb, {
                        pnr: row.pnr,
                        byStaffId: staffId || undefined,
                      }).then(() => undefined),
                    "Saved · guide posted to board"
                  )
                }
              >
                Save & post board
              </button>
            </div>
          </div>
        ) : null}

        {driverNeeded ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Driver · {driverBoard || driverMode === "open" ? "Board open" : driverMode === "claimed" ? "Claimed" : driverMode === "direct" ? "Direct" : "Unassigned"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                className="min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={driverId}
                disabled={saving}
                onChange={(e) => mark(setDriverId)(e.target.value)}
              >
                <option value="">Assign direct…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-300 hover:text-white disabled:opacity-40"
                onClick={() =>
                  void saveThen(
                    () =>
                      postDriverBoard(pb, {
                        pnr: row.pnr,
                        byStaffId: staffId || undefined,
                      }).then(() => undefined),
                    "Saved · driver posted to board"
                  )
                }
              >
                Save & post board
              </button>
            </div>
          </div>
        ) : null}

        {ticketsNeeded ? (
          <div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Ticketer
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={ticketerId}
                disabled={saving}
                onChange={(e) => mark(setTicketerId)(e.target.value)}
              >
                <option value="">—</option>
                {ticketers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Ticket status
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
                value={ticketStatus}
                disabled={saving}
                onChange={(e) => mark(setTicketStatus)(e.target.value)}
              >
                {["none", "needed", "ordered", "done"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {ticketLines.length > 0 ? (
              <ul className="sm:col-span-2 space-y-1 text-xs text-zinc-400">
                {ticketLines.map((line, i) => (
                  <li key={i}>
                    · {line.name || "Line"}
                    {line.qty != null ? ` ×${line.qty}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Pickup notes
          <textarea
            className="mt-1 h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
            value={pickupNotes}
            disabled={saving}
            onChange={(e) => mark(setPickupNotes)(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <button
            type="button"
            disabled={saving || !dirty}
            className="rounded-full bg-[#075473] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            onClick={() => void saveThen(undefined, "Card saved")}
          >
            {saving ? "Saving…" : dirty ? "Save card" : "Saved"}
          </button>
          <OpsStatusBadge status={ticketStatus} />
        </div>
      </div>
    </article>
  );
}
