"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, Search } from "lucide-react";
import type PocketBase from "pocketbase";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsHubRow, StaffOption } from "@/components/staff/opsHubClient";
import type { OpsGuestRequirements } from "@/lib/opsGuestRequirements";
import {
  buildDriverDispatchLegs,
  clearDriverLeg,
  formatDriverLegPriceEur,
  normalizeDriverLegStatus,
  postDriverLegToBoard,
  saveDriverLegAssignment,
  type DriverDispatchLeg,
  type DriverLegStatus,
} from "@/lib/driverDispatch";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

function statusChipClass(status: DriverLegStatus): string {
  switch (status) {
    case "ASSIGNED":
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
    case "OPEN_BOARD":
      return "border-cyan-500/40 bg-cyan-500/15 text-cyan-200";
    default:
      return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
}

function statusLabel(status: DriverLegStatus): string {
  switch (status) {
    case "ASSIGNED":
      return "Assigned";
    case "OPEN_BOARD":
      return "On driver board";
    default:
      return "Unassigned";
  }
}

/** Bulk-select only legs free to re-dispatch (not already assigned). */
function isLegBulkSelectable(status: string | undefined): boolean {
  const s = normalizeDriverLegStatus(status);
  return s === "UNASSIGNED" || s === "OPEN_BOARD";
}

type DraftLeg = DriverDispatchLeg;

/**
 * Tab 4 — Day-by-day Driver Dispatch cards from cart TRANSIT / chauffeur lines.
 * Persists per-leg state on ops_hub.extras.driver_dispatch; board uses ops_dispatch.
 * Card actions / layout mirror GuideDispatchTab (ASSIGN / OPEN BOARD / CLEAR).
 */
export function DriverDispatchConsole({
  pb,
  row,
  dispatch,
  drivers,
  reqs,
  saving,
  staffId,
  onJobsChanged,
}: {
  pb: PocketBase;
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  drivers: StaffOption[];
  reqs: OpsGuestRequirements | null;
  saving: boolean;
  staffId: string | null;
  onJobsChanged?: () => void | Promise<void>;
}) {
  const [legs, setLegs] = useState<DraftLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedLegIds, setSelectedLegIds] = useState<string[]>([]);
  const [bulkDriverId, setBulkDriverId] = useState("");
  const [assignLegId, setAssignLegId] = useState<string | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");

  const paxCount = useMemo(() => {
    const adults = Math.max(0, Number(reqs?.adults) || 0);
    const children = Math.max(0, Number(reqs?.children) || 0);
    const sum = adults + children;
    if (sum > 0) return sum;
    return 1;
  }, [reqs?.adults, reqs?.children]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let hub: OpsHubRow = row;
      try {
        const pnr = String(row.pnr || "")
          .trim()
          .toUpperCase()
          .replace(/"/g, "");
        if (pnr) {
          hub = await pb
            .collection("ops_hub")
            .getFirstListItem<OpsHubRow>(`pnr="${pnr}"`, {
              requestKey: null,
            });
        }
      } catch {
        hub = row;
      }
      const next = buildDriverDispatchLegs({
        hub,
        paxCount,
        dispatch,
        reqs,
      });
      setLegs(next);
      setSelectedLegIds((prev) =>
        prev.filter((id) => {
          const leg = next.find((row) => row.id === id);
          return leg ? isLegBulkSelectable(leg.status) : false;
        })
      );
    } catch (e) {
      setError(formatPbError(e));
      setLegs([]);
    } finally {
      setLoading(false);
    }
  }, [pb, row, paxCount, dispatch, reqs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectableLegIds = useMemo(
    () =>
      legs.filter((l) => isLegBulkSelectable(l.status)).map((l) => l.id),
    [legs]
  );
  const allSelectableSelected =
    selectableLegIds.length > 0 &&
    selectableLegIds.every((id) => selectedLegIds.includes(id));
  const selectedLegs = useMemo(
    () => legs.filter((l) => selectedLegIds.includes(l.id)),
    [legs, selectedLegIds]
  );
  const selectedPriceEur = selectedLegs.reduce(
    (sum, l) => sum + Math.max(0, l.priceEur),
    0
  );
  const totalPriceEur = legs.reduce(
    (sum, l) => sum + Math.max(0, l.priceEur),
    0
  );

  const toggleSelection = (legId: string) => {
    const leg = legs.find((l) => l.id === legId);
    if (!leg || !isLegBulkSelectable(leg.status)) return;
    setSelectedLegIds((prev) =>
      prev.includes(legId)
        ? prev.filter((id) => id !== legId)
        : [...prev, legId]
    );
  };

  const selectAll = () => {
    if (allSelectableSelected) setSelectedLegIds([]);
    else setSelectedLegIds(selectableLegIds);
  };

  const patchLeg = (id: string, patch: Partial<DraftLeg>) => {
    setLegs((prev) =>
      prev.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg))
    );
  };

  const run = async (legId: string, fn: () => Promise<void>, ok: string) => {
    setBusyId(legId);
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await reload();
      await onJobsChanged?.();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (fn: () => Promise<void>) => {
    setBusyId("bulk");
    setError(null);
    setMsg(null);
    try {
      await fn();
      setSelectedLegIds([]);
      setBulkDriverId("");
      await reload();
      await onJobsChanged?.();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkAssign = () => {
    const ids = selectedLegIds.filter((id) => selectableLegIds.includes(id));
    if (ids.length === 0 || !bulkDriverId) return;
    const d = drivers.find((x) => x.id === bulkDriverId);
    const name = d?.name || d?.email || "Driver";
    void runBulk(async () => {
      for (const id of ids) {
        const draft = legs.find((l) => l.id === id);
        if (!draft) continue;
        await saveDriverLegAssignment(pb, {
          pnr: row.pnr,
          byStaffId: staffId || undefined,
          leg: {
            serviceLineId: draft.serviceLineId,
            pickup: draft.pickup,
            dropoff: draft.dropoff,
            vehicleTier: draft.vehicleTier,
            assignedDriverId: bulkDriverId,
            assignedDriverName: name,
            status: "ASSIGNED",
          },
        });
      }
      setMsg(
        `Assigned ${ids.length} leg${ids.length === 1 ? "" : "s"} to ${name}.`
      );
    });
  };

  const handleBulkOpenBoard = () => {
    const ids = selectedLegIds.filter((id) => selectableLegIds.includes(id));
    if (ids.length === 0) return;
    void runBulk(async () => {
      for (const id of ids) {
        const draft = legs.find((l) => l.id === id);
        if (!draft) continue;
        await postDriverLegToBoard(pb, {
          pnr: row.pnr,
          byStaffId: staffId || undefined,
          leg: {
            serviceLineId: draft.serviceLineId,
            pickup: draft.pickup,
            dropoff: draft.dropoff,
            vehicleTier: draft.vehicleTier,
          },
        });
      }
      setMsg(
        `Sent ${ids.length} leg${ids.length === 1 ? "" : "s"} to the driver board.`
      );
    });
  };

  const handleAssignConfirm = () => {
    if (!assignLegId || !assignDriverId) return;
    const draft = legs.find((l) => l.id === assignLegId);
    if (!draft) return;
    const d = drivers.find((x) => x.id === assignDriverId);
    const name = d?.name || d?.email || "Driver";
    const legId = assignLegId;
    void (async () => {
      setBusyId(legId);
      setError(null);
      setMsg(null);
      try {
        await saveDriverLegAssignment(pb, {
          pnr: row.pnr,
          byStaffId: staffId || undefined,
          leg: {
            serviceLineId: draft.serviceLineId,
            pickup: draft.pickup,
            dropoff: draft.dropoff,
            vehicleTier: draft.vehicleTier,
            assignedDriverId: assignDriverId,
            assignedDriverName: name,
            status: "ASSIGNED",
          },
        });
        setMsg(`Assigned to ${name}`);
        setAssignLegId(null);
        setAssignDriverId("");
        await reload();
        await onJobsChanged?.();
      } catch (e) {
        setError(formatPbError(e));
      } finally {
        setBusyId(null);
      }
    })();
  };

  const assignedCount = legs.filter(
    (l) => normalizeDriverLegStatus(l.status) === "ASSIGNED"
  ).length;
  const openCount = legs.filter(
    (l) => normalizeDriverLegStatus(l.status) === "OPEN_BOARD"
  ).length;
  const bulkBusy = busyId === "bulk" || saving;
  const assignDraft = assignLegId
    ? legs.find((l) => l.id === assignLegId) || null
    : null;

  const driverNeeded =
    legs.length > 0 ||
    row.driver_needed === true ||
    dispatch?.driver_needed === true ||
    Boolean(dispatch?.assigned_driver_id);

  return (
    <div className="max-w-4xl space-y-4 text-xs text-white">
      <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="font-sans text-sm font-semibold tracking-wider text-[#F6A724] uppercase">
              Day-by-day driver dispatch
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Chauffeur / transfer / private vehicle lines only — each leg is
              its own card. Suica and ticket bonuses stay on the Tickets tab.
              Assign fleet per leg, or select multiple for bulk actions.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold tracking-wider text-zinc-300 uppercase disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            {loading ? "Syncing…" : "Sync legs"}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-[11px] text-zinc-400">
          <span>
            Requirement:{" "}
            <strong className="text-zinc-200">
              {driverNeeded ? "Driver needed" : "Not required"}
            </strong>
          </span>
          <span>
            Legs:{" "}
            <strong className="text-white tabular-nums">{legs.length}</strong>
          </span>
          <span>
            Package driver pay (sum of legs):{" "}
            <strong className="text-emerald-400 tabular-nums">
              {formatDriverLegPriceEur(totalPriceEur)}
            </strong>
          </span>
          <span>
            Assigned:{" "}
            <strong className="text-emerald-400 tabular-nums">
              {assignedCount}
            </strong>
          </span>
          <span>
            On board:{" "}
            <strong className="text-cyan-300 tabular-nums">{openCount}</strong>
          </span>
          {dispatch?.assigned_driver ? (
            <span>
              PNR rollup:{" "}
              <strong className="text-zinc-200">
                {dispatch.assigned_driver}
              </strong>
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-300">
            {msg}
          </p>
        ) : null}

        {loading && legs.length === 0 ? (
          <p className="text-zinc-500">Loading transit legs from cart…</p>
        ) : legs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-black/40 px-3 py-4 text-[11px] text-zinc-500">
            No private transit / chauffeur / transfer lines in the invoice cart
            yet. Add Alphard, HiAce, airport transfer, or private vehicle lines
            in Pricing Studio.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className={`inline-flex items-center gap-2 text-[11px] ${
                  selectableLegIds.length === 0
                    ? "cursor-not-allowed text-zinc-600"
                    : "cursor-pointer text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={selectAll}
                  disabled={selectableLegIds.length === 0}
                  className="h-4 w-4 rounded border-white/20 bg-black/50 text-[#075473] focus:ring-[#075473] disabled:cursor-not-allowed disabled:opacity-40"
                />
                {allSelectableSelected
                  ? "Clear selection"
                  : "Select all available legs"}
              </label>
              {selectedLegIds.length > 0 ? (
                <span className="text-[10px] text-zinc-500">
                  Tip: assign airport + hotel legs in one click
                </span>
              ) : selectableLegIds.length === 0 ? (
                <span className="text-[10px] text-zinc-600">
                  Assigned legs are locked
                </span>
              ) : null}
            </div>

            {selectedLegIds.length > 0 ? (
              <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#075473]/50 bg-[#075473]/25 p-3 backdrop-blur-md">
                <div className="text-[12px] font-bold text-white">
                  <span className="text-cyan-300">{selectedLegIds.length}</span>{" "}
                  leg{selectedLegIds.length === 1 ? "" : "s"} selected
                  <span className="ml-2 font-mono text-[11px] font-normal text-zinc-300">
                    {formatDriverLegPriceEur(selectedPriceEur)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkDriverId}
                    disabled={bulkBusy}
                    onChange={(e) => setBulkDriverId(e.target.value)}
                    aria-label="Driver for bulk assign"
                    className="min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white disabled:opacity-40"
                  >
                    <option value="">Driver / fleet…</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkBusy || !bulkDriverId}
                    onClick={handleBulkAssign}
                    className="rounded-lg bg-[#075473] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg disabled:opacity-40"
                  >
                    {busyId === "bulk" ? "Saving…" : "Assign selected"}
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={handleBulkOpenBoard}
                    className="rounded-lg border border-[#F6A724]/50 bg-[#F6A724]/20 px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase disabled:opacity-40"
                  >
                    {busyId === "bulk" ? "Sending…" : "Open board"}
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => {
                      setSelectedLegIds([]);
                      setBulkDriverId("");
                    }}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase hover:text-white disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {legs.map((leg) => {
              const status = normalizeDriverLegStatus(leg.status);
              const selectable = isLegBulkSelectable(status);
              const busy = busyId === leg.id || bulkBusy;
              const checked = selectable && selectedLegIds.includes(leg.id);
              return (
                <div
                  key={leg.id}
                  className={`flex gap-3 rounded-xl border p-4 ${
                    checked
                      ? "border-[#075473]/60 bg-[#075473]/10"
                      : "border-white/10 bg-black/40"
                  } ${!selectable ? "opacity-80" : ""}`}
                >
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(leg.id)}
                      disabled={!selectable}
                      title={
                        selectable
                          ? "Select for bulk assign"
                          : "Locked — already assigned"
                      }
                      aria-label={
                        selectable
                          ? `Select ${leg.title}`
                          : `${leg.title} locked (${status})`
                      }
                      className={`h-5 w-5 rounded border-white/20 focus:ring-[#075473] ${
                        selectable
                          ? "cursor-pointer bg-black/50 text-[#075473]"
                          : "cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500 opacity-40"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-emerald-400">
                          {leg.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {leg.dayLabel}
                          {leg.city ? ` · ${leg.city}` : ""}
                          {" · "}
                          {leg.pax} pax
                          {leg.vehicleTier
                            ? ` · ${leg.vehicleTier}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-white">
                          {formatDriverLegPriceEur(leg.priceEur)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${statusChipClass(status)}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                        Pickup / pier / terminal
                        <span className="mt-1 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                          <input
                            type="text"
                            value={leg.pickup}
                            disabled={busy}
                            placeholder="Meeting point / hotel lobby"
                            onChange={(e) =>
                              patchLeg(leg.id, { pickup: e.target.value })
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-white placeholder:text-zinc-600 disabled:opacity-40"
                          />
                        </span>
                      </label>
                      <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                        Drop-off
                        <span className="mt-1 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                          <input
                            type="text"
                            value={leg.dropoff}
                            disabled={busy}
                            placeholder="e.g. Hotel · cruise pier"
                            onChange={(e) =>
                              patchLeg(leg.id, { dropoff: e.target.value })
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-white placeholder:text-zinc-600 disabled:opacity-40"
                          />
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-[15.4px]">
                        {leg.assignedDriverName ? (
                          <>
                            <span className="font-bold text-white">
                              {leg.assignedDriverName}
                            </span>
                            <span className="ml-2 text-zinc-500">
                              {status === "ASSIGNED"
                                ? "Confirmed for this leg"
                                : status === "OPEN_BOARD"
                                  ? "On open board"
                                  : statusLabel(status)}
                            </span>
                          </>
                        ) : (
                          <span className="italic text-zinc-500">
                            No driver for this leg yet
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setAssignDriverId(leg.assignedDriverId || "");
                            setAssignLegId(leg.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#075473] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase disabled:opacity-40"
                        >
                          <Search className="h-3 w-3" />
                          Assign
                        </button>
                        <button
                          type="button"
                          disabled={busy || status === "ASSIGNED"}
                          onClick={() => {
                            const draft = legs.find((l) => l.id === leg.id);
                            if (!draft) return;
                            void run(
                              leg.id,
                              async () => {
                                await postDriverLegToBoard(pb, {
                                  pnr: row.pnr,
                                  byStaffId: staffId || undefined,
                                  leg: {
                                    serviceLineId: draft.serviceLineId,
                                    pickup: draft.pickup,
                                    dropoff: draft.dropoff,
                                    vehicleTier: draft.vehicleTier,
                                  },
                                });
                              },
                              "Posted to driver board"
                            );
                          }}
                          className="rounded-lg border border-[#F6A724]/50 bg-[#F6A724]/15 px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase disabled:opacity-40"
                        >
                          Open board
                        </button>
                        {leg.assignedDriverId || status === "OPEN_BOARD" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                leg.id,
                                async () => {
                                  await clearDriverLeg(pb, {
                                    pnr: row.pnr,
                                    serviceLineId: leg.serviceLineId,
                                    byStaffId: staffId || undefined,
                                  });
                                },
                                "Driver cleared"
                              )
                            }
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase disabled:opacity-40"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-zinc-600">
          Per-leg pickup / drop-off / driver is stored on{" "}
          <span className="font-mono text-zinc-500">
            ops_hub.extras.driver_dispatch
          </span>
          . Open board also opens the PNR on the existing{" "}
          <span className="font-mono text-zinc-500">ops_dispatch</span> driver
          board.
        </p>
      </div>

      {assignDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold tracking-wider text-[#F6A724] uppercase">
                Assign driver
              </h3>
              <p className="mt-1 text-[11px] text-zinc-400">
                {assignDraft.title}
                {" · "}
                {assignDraft.dayLabel}
                {assignDraft.city ? ` · ${assignDraft.city}` : ""}
              </p>
            </div>
            <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Driver / fleet partner
              <select
                value={assignDriverId}
                onChange={(e) => setAssignDriverId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs font-normal normal-case tracking-normal text-white"
              >
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignLegId(null);
                  setAssignDriverId("");
                }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assignDriverId || busyId === assignDraft.id}
                onClick={handleAssignConfirm}
                className="rounded-lg bg-[#075473] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase disabled:opacity-40"
              >
                {busyId === assignDraft.id ? "Saving…" : "Confirm assign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
