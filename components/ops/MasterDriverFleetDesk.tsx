"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Car, RefreshCw } from "lucide-react";
import {
  buildDriverDispatchLegs,
  type DriverDispatchLeg,
} from "@/lib/driverDispatch";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { useTeamAuth } from "@/store/useTeamAuth";
import {
  loadOpsHub,
  loadStaffByRole,
  OpsStatusBadge,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";

type LegRow = DriverDispatchLeg & { pnr: string; hubStatus?: string };

/**
 * Cross-hub Master Driver & Fleet Desk.
 * Uses staff (role=driver), ops_dispatch, and ops_hub.extras.driver_dispatch.
 */
export function MasterDriverFleetDesk() {
  return (
    <StaffPortalShell
      title="Master Driver & Fleet"
      allow={canAccessOpsBoard}
      wide
    >
      <MasterDriverFleetInner />
    </StaffPortalShell>
  );
}

function MasterDriverFleetInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [drivers, setDrivers] = useState<StaffOption[]>([]);
  const [dispatchRows, setDispatchRows] = useState<OpsDispatchRow[]>([]);
  const [legs, setLegs] = useState<LegRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [legFilter, setLegFilter] = useState<"all" | "open" | "assigned">(
    "all"
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const [staffList, hubs, dispatches] = await Promise.all([
        loadStaffByRole(pb, "driver"),
        loadOpsHub(pb),
        pb
          .collection("ops_dispatch")
          .getFullList<OpsDispatchRow>({
            sort: "-updated",
            requestKey: null,
          })
          .catch(() => [] as OpsDispatchRow[]),
      ]);

      setDrivers(staffList);
      setDispatchRows(dispatches);

      const allLegs: LegRow[] = [];
      for (const hub of hubs) {
        const built = buildDriverDispatchLegs({ hub, paxCount: 1 });
        for (const leg of built) {
          allLegs.push({
            ...leg,
            pnr: String(hub.pnr || "").toUpperCase(),
            hubStatus: hub.status,
          });
        }
      }
      allLegs.sort((a, b) => {
        const da = a.serviceDate || "";
        const db = b.serviceDate || "";
        if (da !== db) return da.localeCompare(db);
        return a.pnr.localeCompare(b.pnr);
      });
      setLegs(allLegs);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onRefresh = () => void reload();
    window.addEventListener("staff-portal-refresh", onRefresh);
    return () => window.removeEventListener("staff-portal-refresh", onRefresh);
  }, [reload]);

  const assignedByDriver = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dispatchRows) {
      const id = String(d.assigned_driver_id || "").trim();
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    for (const leg of legs) {
      const id = String(leg.assignedDriverId || "").trim();
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [dispatchRows, legs]);

  const filteredLegs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return legs.filter((leg) => {
      if (legFilter === "open" && leg.status !== "UNASSIGNED" && leg.status !== "OPEN_BOARD")
        return false;
      if (legFilter === "assigned" && leg.status !== "ASSIGNED") return false;
      if (!needle) return true;
      const hay = [
        leg.pnr,
        leg.title,
        leg.pickup,
        leg.dropoff,
        leg.assignedDriverName,
        leg.vehicleTier,
        leg.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [legs, legFilter, q]);

  const openLegs = legs.filter(
    (l) => l.status === "UNASSIGNED" || l.status === "OPEN_BOARD"
  ).length;
  const assignedLegs = legs.filter((l) => l.status === "ASSIGNED").length;
  const pnrAssigned = dispatchRows.filter((d) =>
    Boolean(String(d.assigned_driver_id || "").trim())
  ).length;
  const pnrOpen = dispatchRows.filter(
    (d) =>
      (d.driver_board_visible || d.driver_mode === "open") &&
      !String(d.assigned_driver_id || "").trim()
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">
            Fleet roster and chauffeur legs across all hubs (
            <code className="text-zinc-500">staff</code>,{" "}
            <code className="text-zinc-500">ops_dispatch</code>,{" "}
            <code className="text-zinc-500">ops_hub.extras.driver_dispatch</code>
            ). Assign from a booking inspector Tab 4.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {drivers.length} drivers · {legs.length} transit legs ({openLegs}{" "}
            open / {assignedLegs} assigned) · {pnrAssigned} PNR drivers assigned
            · {pnrOpen} on board
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Car className="h-4 w-4 text-[#7dd3fc]" />
          Driver roster
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : drivers.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No active driver staff yet. Create driver accounts in Team Access /
            Users.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drivers.map((d) => {
              const n = assignedByDriver.get(d.id) || 0;
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
                >
                  <p className="truncate text-sm font-medium text-white">
                    {d.name || d.email}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">{d.email}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {n} assignment{n === 1 ? "" : "s"} (PNR + legs)
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold text-white">
            Transit / chauffeur legs
          </h2>
          {(
            [
              ["all", "All legs"],
              ["open", "Unassigned / board"],
              ["assigned", "Assigned"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLegFilter(id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                legFilter === id
                  ? "bg-[#075473]/35 text-[#7dd3fc]"
                  : "border border-zinc-700 text-zinc-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PNR, route, driver…"
            className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white sm:ml-2"
          />
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filteredLegs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No transit legs yet — they appear when cart TRANSIT lines exist on
            ops_hub.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">PNR</th>
                  <th className="px-2 py-2">Service</th>
                  <th className="px-2 py-2">Route</th>
                  <th className="px-2 py-2">Vehicle</th>
                  <th className="px-2 py-2">Driver</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLegs.map((leg) => (
                  <tr
                    key={`${leg.pnr}-${leg.id}`}
                    className="border-b border-zinc-900/80 text-zinc-300"
                  >
                    <td className="px-2 py-2 whitespace-nowrap">
                      {leg.dayLabel || leg.serviceDate || "TBD"}
                    </td>
                    <td className="px-2 py-2 font-mono">
                      <Link
                        href={`/ops?pnr=${encodeURIComponent(leg.pnr)}`}
                        className="text-[#7dd3fc] hover:underline"
                      >
                        {leg.pnr}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <span className="line-clamp-2">{leg.title}</span>
                    </td>
                    <td className="px-2 py-2 text-zinc-400">
                      <span className="line-clamp-2">
                        {[leg.pickup, leg.dropoff].filter(Boolean).join(" → ") ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2">{leg.vehicleTier || "—"}</td>
                    <td className="px-2 py-2">
                      {leg.assignedDriverName || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <OpsStatusBadge status={leg.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">
          PNR-level driver dispatch
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : dispatchRows.length === 0 ? (
          <p className="text-sm text-zinc-500">No ops_dispatch rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2">PNR</th>
                  <th className="px-2 py-2">Mode</th>
                  <th className="px-2 py-2">Assigned driver</th>
                  <th className="px-2 py-2">Board</th>
                </tr>
              </thead>
              <tbody>
                {dispatchRows.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-900/80 text-zinc-300"
                  >
                    <td className="px-2 py-2 font-mono">
                      <Link
                        href={`/ops?pnr=${encodeURIComponent(d.pnr)}`}
                        className="text-[#7dd3fc] hover:underline"
                      >
                        {d.pnr}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{String(d.driver_mode || "—")}</td>
                    <td className="px-2 py-2">
                      {d.assigned_driver || d.assigned_driver_id || "—"}
                    </td>
                    <td className="px-2 py-2">
                      {d.driver_board_visible ? "Visible" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
