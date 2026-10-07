"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  claimDriverJob,
  type OpsDispatchRow,
} from "@/lib/opsDispatch";
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
import {
  acceptGuideJob,
  formatGuideJobDateLabel,
  listGuideJobsForStaff,
  listOpenBoardGuideJobs,
  normalizeGuideJobStatus,
  refuseGuideJobDay,
  type GuideJobRow,
} from "@/lib/guideJobs";

type GuideJobGroup = {
  pnr: string;
  jobs: GuideJobRow[];
};

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
  const [guideJobs, setGuideJobs] = useState<GuideJobRow[]>([]);
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
        setGuideJobs([]);
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
        setGuideJobs([]);
        return;
      }

      // Guides: per-day jobs from guide_jobs
      if (kind === "guide") {
        setDispatchRows([]);
        if (tab === "mine") {
          const mine = staffId
            ? await listGuideJobsForStaff(pb, staffId)
            : [];
          setGuideJobs(
            mine.filter((j) => {
              const s = normalizeGuideJobStatus(j.status);
              return s === "OFFERED" || s === "ACCEPTED" || s === "COMPLETED";
            })
          );
        } else {
          setGuideJobs(await listOpenBoardGuideJobs(pb));
        }
        setPayouts([]);
        if (tab === "mine" && staffId) {
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
        return;
      }

      // Drivers: legacy PNR-level ops_dispatch
      let filter = "";
      if (tab === "mine") {
        filter =
          role === "driver" && staffId
            ? `assigned_driver_id="${staffId}"`
            : `assigned_driver_id != ""`;
      } else {
        filter = `(driver_board_visible=true || driver_mode="open") && assigned_driver_id=""`;
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
          if (d.assigned_driver_id) return true;
          return d.driver_needed !== false;
        })
      );
      setGuideJobs([]);
      setPayouts([]);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient, kind, role, staffId, tab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupedGuideJobs = useMemo((): GuideJobGroup[] => {
    const map = new Map<string, GuideJobRow[]>();
    for (const job of guideJobs) {
      const pnr = String(job.pnr || "UNKNOWN")
        .trim()
        .toUpperCase();
      const list = map.get(pnr) || [];
      list.push(job);
      map.set(pnr, list);
    }
    return Array.from(map.entries()).map(([pnr, jobs]) => ({
      pnr,
      jobs: [...jobs].sort((a, b) => {
        const da = String(a.tour_date || "");
        const db = String(b.tour_date || "");
        if (da !== db) return da.localeCompare(db);
        return (Number(a.day_index) || 0) - (Number(b.day_index) || 0);
      }),
    }));
  }, [guideJobs]);

  const onClaimDriver = async (pnr: string) => {
    if (!staffId) {
      setMsg("Sign in as driver staff to claim.");
      return;
    }
    setClaiming(pnr);
    setMsg(null);
    try {
      const pb = getClient();
      await claimDriverJob(pb, { pnr, staffId, staffName });
      setMsg(`Accepted ${pnr}`);
      setTab("mine");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  const onAcceptGuideDay = async (jobId: string, label: string) => {
    if (!staffId) {
      setMsg("Sign in as guide staff to accept.");
      return;
    }
    setClaiming(jobId);
    setMsg(null);
    try {
      const pb = getClient();
      await acceptGuideJob(pb, { jobId, staffId, staffName });
      setMsg(`Accepted: ${label}`);
      setTab("mine");
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setClaiming(null);
    }
  };

  const onRefuseGuideDay = async (jobId: string, label: string) => {
    if (!staffId) {
      setMsg("Sign in as guide staff to refuse.");
      return;
    }
    setClaiming(jobId);
    setMsg(null);
    try {
      const pb = getClient();
      await refuseGuideJobDay(pb, { jobId, staffId });
      setMsg(`Refused: ${label} — Ops can reassign`);
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
          {kind === "guide"
            ? "Per-day tour jobs · accept/refuse each day · payouts from ops_payouts. "
            : "Jobs from dispatch · payouts from ops_payouts · rate cards for payroll. "}
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
      ) : kind === "guide" ? (
        <ul className="space-y-5">
          {groupedGuideJobs.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              {tab === "mine"
                ? "No day jobs assigned to you yet."
                : "No open day jobs on the board."}
            </li>
          ) : (
            groupedGuideJobs.map((group) => {
              const hub = hubByPnr[group.pnr];
              const asgId = assignmentByPnr[group.pnr];
              const actionable = group.jobs.filter((j) => {
                const s = normalizeGuideJobStatus(j.status);
                return s === "OFFERED" || s === "OPEN_BOARD";
              });
              const totalUpTo = group.jobs.reduce(
                (sum, j) => sum + Math.max(0, Number(j.payout_jpy) || 0),
                0
              );
              const offeredUpTo = actionable.reduce(
                (sum, j) => sum + Math.max(0, Number(j.payout_jpy) || 0),
                0
              );
              return (
                <li
                  key={group.pnr}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 shadow-lg"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {group.jobs.length > 1
                          ? "Multi-day package"
                          : "Tour day"}
                        : {group.pnr}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {tab === "board"
                          ? "Claim the days you can cover below."
                          : "Accept or reject each day you were offered."}
                        {hub?.guest_summary ? ` · ${hub.guest_summary}` : ""}
                        {hub?.primary_city ? ` · ${hub.primary_city}` : ""}
                      </p>
                      <div className="mt-2">
                        <OpsStatusBadge status={hub?.status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-[#F6A724]">
                        {offeredUpTo > 0
                          ? `Up to ¥${offeredUpTo.toLocaleString("en-US")}`
                          : `¥${totalUpTo.toLocaleString("en-US")}`}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                        {group.jobs.length} day
                        {group.jobs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.jobs.map((job) => {
                      const status = normalizeGuideJobStatus(job.status);
                      const canAct =
                        status === "OFFERED" || status === "OPEN_BOARD";
                      return (
                        <div
                          key={job.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-emerald-400">
                              {job.tour_name}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-400">
                              {formatGuideJobDateLabel(job.tour_date)}
                              {job.city ? ` · ${job.city}` : ""}
                              {" · "}
                              {Math.max(1, Number(job.duration_hours) || 6)}h
                              {" · "}
                              {Math.max(1, Number(job.pax_count) || 1)} pax
                              {job.day_index
                                ? ` · Day ${job.day_index}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-mono text-sm font-bold text-white">
                              ¥
                              {Math.max(
                                0,
                                Number(job.payout_jpy) || 0
                              ).toLocaleString("en-US")}
                            </p>
                            {canAct ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={claiming === job.id || !staffId}
                                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                  onClick={() =>
                                    void onAcceptGuideDay(
                                      job.id,
                                      job.tour_name
                                    )
                                  }
                                >
                                  {claiming === job.id
                                    ? "…"
                                    : tab === "board"
                                      ? "Claim"
                                      : "Accept"}
                                </button>
                                {status === "OFFERED" ? (
                                  <button
                                    type="button"
                                    disabled={
                                      claiming === job.id || !staffId
                                    }
                                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-50"
                                    onClick={() =>
                                      void onRefuseGuideDay(
                                        job.id,
                                        job.tour_name
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span
                                className={`text-[10px] font-bold tracking-wider uppercase ${
                                  status === "ACCEPTED" ||
                                  status === "COMPLETED"
                                    ? "text-emerald-400"
                                    : status === "REJECTED"
                                      ? "text-red-400"
                                      : "text-zinc-500"
                                }`}
                              >
                                {status.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {tab === "mine" &&
                  asgId &&
                  group.jobs.some(
                    (j) => normalizeGuideJobStatus(j.status) === "ACCEPTED"
                  ) ? (
                    <div className="mt-4 border-t border-zinc-800 pt-3">
                      <TourCompletionReportForm
                        pb={getClient()}
                        pnr={group.pnr}
                        assignmentId={asgId}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })
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
                    <OpsStatusBadge status={hub?.status} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-400">
                    {hub?.pickup_notes || "No pickup notes yet."}
                  </p>
                  {tab === "board" ? (
                    <button
                      type="button"
                      disabled={claiming === d.pnr || !staffId}
                      className="mt-3 rounded-lg bg-[#075473] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void onClaimDriver(d.pnr)}
                    >
                      {claiming === d.pnr ? "Claiming…" : "Claim job"}
                    </button>
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
