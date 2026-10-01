"use client";

import { useCallback, useEffect, useState } from "react";
import {
  claimDriverJob,
  claimGuideJob,
  refuseGuideJob,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
import {
  guideConfirmStaffLabel,
  isGuidePendingAcceptance,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import {
  loadPayoutsForStaff,
  type OpsPayoutRow,
} from "@/lib/opsPayouts";
import { canAccessDriver, canAccessGuide } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  OpsStatusBadge,
  loadOpsHub,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import Link from "next/link";
import { GuideRateCardEditor } from "@/components/staff/GuideRateCardEditor";
import { DriverRateSheetEditor } from "@/components/staff/DriverRateSheetEditor";
import { TourCompletionReportForm } from "@/components/staff/TourCompletionReportForm";

export function GuideApp() {
  return (
    <StaffPortalShell title="Guide portal" allow={canAccessGuide}>
      <DispatchPortal kind="guide" />
    </StaffPortalShell>
  );
}

export function DriverApp() {
  return (
    <StaffPortalShell title="Driver portal" allow={canAccessDriver}>
      <DispatchPortal kind="driver" />
    </StaffPortalShell>
  );
}

type Tab = "mine" | "board" | "payouts" | "rates";

function DispatchPortal({ kind }: { kind: "guide" | "driver" }) {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);
  const email = useTeamAuth((s) => s.email);
  const record = useTeamAuth((s) => s.record);
  const [tab, setTab] = useState<Tab>("mine");
  const [hubByPnr, setHubByPnr] = useState<Record<string, OpsHubRow>>({});
  const [dispatchRows, setDispatchRows] = useState<OpsDispatchRow[]>([]);
  const [payouts, setPayouts] = useState<OpsPayoutRow[]>([]);
  const [assignmentByPnr, setAssignmentByPnr] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const staffName =
    String(
      (record as { name?: string } | null)?.name || record?.email || ""
    ).trim() || "Staff";

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const hubs = await loadOpsHub(pb);
      const map: Record<string, OpsHubRow> = {};
      for (const h of hubs) map[String(h.pnr).toUpperCase()] = h;
      setHubByPnr(map);

      if (tab === "rates") {
        setDispatchRows([]);
        setPayouts([]);
        return;
      }

      if (tab === "payouts") {
        if (staffId) {
          const list = await loadPayoutsForStaff(pb, staffId);
          setPayouts(list.filter((p) => p.role === kind));
        } else if (role === "owner" || role === "ops") {
          const list = await pb
            .collection("ops_payouts")
            .getFullList<OpsPayoutRow>({
              filter: `role="${kind}"`,
              sort: "-updated",
              requestKey: null,
            });
          setPayouts(list);
        } else {
          setPayouts([]);
        }
        setDispatchRows([]);
        return;
      }

      let filter = "";
      if (tab === "mine") {
        if ((role === "guide" || role === "driver") && staffId) {
          filter =
            kind === "guide"
              ? `assigned_guide_id="${staffId}"`
              : `assigned_driver_id="${staffId}"`;
        } else {
          filter =
            kind === "guide"
              ? `assigned_guide_id != ""`
              : `assigned_driver_id != ""`;
        }
      } else {
        filter =
          kind === "guide"
            ? `(guide_board_visible=true || guide_mode="open" || guide_mode="posted_open_board") && assigned_guide_id=""`
            : `(driver_board_visible=true || driver_mode="open") && assigned_driver_id=""`;
      }

      const list = await pb
        .collection("ops_dispatch")
        .getFullList<OpsDispatchRow>({
          filter,
          sort: "-updated",
          requestKey: null,
        });
      setDispatchRows(
        list.filter((d) => {
          if (kind === "guide") {
            if (d.assigned_guide_id) return true;
            return d.guide_needed !== false;
          }
          if (d.assigned_driver_id) return true;
          return d.driver_needed !== false;
        })
      );
      setPayouts([]);

      if (kind === "guide" && tab === "mine" && staffId) {
        try {
          const asgs = await pb
            .collection("itinerary_guide_assignments")
            .getFullList<{ id: string; pnr: string; staff_id?: string }>({
              filter: `staff_id="${staffId}"`,
              requestKey: null,
            });
          const amap: Record<string, string> = {};
          for (const a of asgs) amap[String(a.pnr).toUpperCase()] = a.id;
          setAssignmentByPnr(amap);
        } catch {
          setAssignmentByPnr({});
        }
      }
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient, kind, role, staffId, tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onClaim = async (pnr: string) => {
    if (!staffId) {
      setMsg("Sign in as guide/driver staff to claim.");
      return;
    }
    setClaiming(pnr);
    setMsg(null);
    try {
      const pb = getClient();
      if (kind === "guide") {
        await claimGuideJob(pb, { pnr, staffId, staffName });
      } else {
        await claimDriverJob(pb, { pnr, staffId, staffName });
      }
      setMsg(`Accepted ${pnr}`);
      setTab("mine");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  const onRefuse = async (pnr: string) => {
    if (!staffId) {
      setMsg("Sign in as guide staff to refuse.");
      return;
    }
    setClaiming(pnr);
    setMsg(null);
    try {
      const pb = getClient();
      await refuseGuideJob(pb, { pnr, staffId });
      setMsg(`Refused ${pnr} — Ops can reassign or post board`);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Jobs from dispatch · payouts from ops_payouts · rate cards for payroll.{" "}
          <Link href="/profile" className="text-[#075473] hover:underline">
            Edit profile
          </Link>
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["mine", "My jobs"],
            ["board", "Open board"],
            ["payouts", "My payouts"],
            ["rates", kind === "guide" ? "Rate card" : "Rate sheet"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === id
                ? "bg-[#075473]/30 text-[#075473]"
                : "border border-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : tab === "rates" ? (
        staffId ? (
          kind === "guide" ? (
            <GuideRateCardEditor
              getClient={getClient}
              staffId={staffId}
              seedName={staffName}
              seedEmail={email || undefined}
            />
          ) : (
            <DriverRateSheetEditor
              getClient={getClient}
              staffId={staffId}
              seedName={staffName}
            />
          )
        ) : (
          <p className="text-sm text-zinc-500">
            Sign in as staff to edit your rate card.
          </p>
        )
      ) : tab === "payouts" ? (
        <ul className="space-y-3">
          {payouts.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              No payouts yet — assigned after ops sets your job pay.
            </li>
          ) : (
            payouts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <div>
                  <p className="font-mono text-sm text-white">{p.pnr}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {hubByPnr[String(p.pnr).toUpperCase()]?.primary_city ||
                      "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">
                    ¥{Number(p.amount_jpy || 0).toLocaleString()}
                  </p>
                  <OpsStatusBadge status={p.status || "pending"} />
                </div>
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="space-y-3">
          {dispatchRows.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              {tab === "mine"
                ? "No assignments yet."
                : "No open jobs on the board."}
            </li>
          ) : (
            dispatchRows.map((d) => {
              const hub = hubByPnr[String(d.pnr).toUpperCase()];
              const asgId = assignmentByPnr[String(d.pnr).toUpperCase()];
              const guideStatus =
                kind === "guide"
                  ? normalizeGuideConfirmStatus(d.guide_mode, {
                      boardVisible: Boolean(d.guide_board_visible),
                      assignedGuideId: d.assigned_guide_id,
                      guideResponse: d.guide_response,
                    })
                  : null;
              const needsAccept =
                kind === "guide" &&
                tab === "mine" &&
                isGuidePendingAcceptance(d.guide_mode, d.guide_response);
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-white">{d.pnr}</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {hub?.primary_city || "—"} ·{" "}
                        {hub?.tour_date
                          ? String(hub.tour_date).slice(0, 10)
                          : "date TBD"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {hub?.guest_summary || "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <OpsStatusBadge status={hub?.status} />
                      {guideStatus ? (
                        <span className="text-[10px] tracking-wider text-zinc-500 uppercase">
                          {guideConfirmStaffLabel(guideStatus)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-400">
                    {hub?.pickup_notes ||
                      (kind === "driver"
                        ? "No pickup notes yet."
                        : "Special requests / pickup notes appear when ops sets them.")}
                  </p>
                  {tab === "board" ? (
                    <button
                      type="button"
                      disabled={claiming === d.pnr || !staffId}
                      className="mt-3 rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void onClaim(d.pnr)}
                    >
                      {claiming === d.pnr ? "Claiming…" : "Claim job"}
                    </button>
                  ) : null}
                  {needsAccept ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={claiming === d.pnr || !staffId}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => void onClaim(d.pnr)}
                      >
                        {claiming === d.pnr ? "Accepting…" : "Accept job"}
                      </button>
                      <button
                        type="button"
                        disabled={claiming === d.pnr || !staffId}
                        className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-50"
                        onClick={() => void onRefuse(d.pnr)}
                      >
                        {claiming === d.pnr ? "…" : "Refuse job"}
                      </button>
                    </div>
                  ) : null}
                  {kind === "guide" && tab === "mine" && asgId ? (
                    <TourCompletionReportForm
                      pb={getClient()}
                      pnr={d.pnr}
                      assignmentId={asgId}
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
