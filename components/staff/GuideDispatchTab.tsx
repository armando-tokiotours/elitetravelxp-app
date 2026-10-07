"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type PocketBase from "pocketbase";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsHubRow, StaffOption } from "@/components/staff/opsHubClient";
import type { OpsGuestRequirements } from "@/lib/opsGuestRequirements";
import {
  guideRecordToMatchProfile,
  type GuideMatchProfile,
} from "@/lib/guideMatcher";
import {
  isNightTourHours,
  loadGuideDayBookings,
  type GuideDayBooking,
} from "@/lib/guideScheduleRules";
import { GuideSearchModal } from "@/components/staff/GuideSearchModal";
import {
  clearGuideJob,
  formatGuideJobDateLabel,
  listGuideJobsForPnr,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  offerGuideJob,
  postGuideJobToBoard,
  servicesFromHub,
  syncGuideJobsForBooking,
  type GuideJobRow,
} from "@/lib/guideJobs";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

function jobStatusClass(status: string): string {
  switch (normalizeGuideJobStatus(status)) {
    case "ACCEPTED":
    case "COMPLETED":
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
    case "OFFERED":
      return "border-amber-500/40 bg-amber-500/20 text-amber-300";
    case "OPEN_BOARD":
      return "border-cyan-500/40 bg-cyan-500/15 text-cyan-200";
    case "REJECTED":
      return "border-red-500/40 bg-red-500/15 text-red-300";
    default:
      return "border-white/10 bg-zinc-800 text-gray-400";
  }
}

/** Bulk-select only days that are free to re-dispatch (not in a guide inbox / locked). */
function isJobBulkSelectable(status: string | undefined): boolean {
  const s = normalizeGuideJobStatus(status);
  return s === "UNASSIGNED" || s === "OPEN_BOARD" || s === "REJECTED";
}

/**
 * Tab 3 — Per-day / per-tour Guide Dispatch (guide_jobs).
 * Multi-day PNRs are split so each tour day can have its own guide.
 */
export function GuideDispatchTab({
  pb,
  row,
  dispatch: _dispatch,
  guides,
  reqs,
  saving,
  showPayoutPanel: _showPayoutPanel,
  onAssignGuide: _onAssignGuide,
  onPostToOpenBoard: _onPostToOpenBoard,
  onClearGuide: _onClearGuide,
  onJobsChanged,
}: {
  pb: PocketBase;
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  guides: StaffOption[];
  reqs: OpsGuestRequirements | null;
  saving: boolean;
  showPayoutPanel: boolean;
  onAssignGuide: (guideStaffId: string) => Promise<void>;
  onPostToOpenBoard: () => Promise<void>;
  onClearGuide: () => Promise<void>;
  /** Optional: parent can refresh hub/dispatch rollup */
  onJobsChanged?: () => void | Promise<void>;
}) {
  const [jobs, setJobs] = useState<GuideJobRow[]>([]);
  const [profiles, setProfiles] = useState<GuideMatchProfile[]>([]);
  const [dayBookings, setDayBookings] = useState<GuideDayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignJobId, setAssignJobId] = useState<string | null>(null);
  /** When true, GuideSearchModal assigns to all selectedJobIds */
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const pnrKey = String(row.pnr || "")
    .trim()
    .toUpperCase();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const synced = await syncGuideJobsForBooking(pb, {
        pnr: pnrKey,
        reqs,
        hub: row,
        services: servicesFromHub(row),
      });
      setJobs(synced);
      setSelectedJobIds((prev) =>
        prev.filter((id) => {
          const j = synced.find((row) => row.id === id);
          return j ? isJobBulkSelectable(j.status) : false;
        })
      );
    } catch (e) {
      setError(formatPbError(e));
      try {
        const listed = await listGuideJobsForPnr(pb, pnrKey);
        setJobs(listed);
        setSelectedJobIds((prev) =>
          prev.filter((id) => {
            const j = listed.find((row) => row.id === id);
            return j ? isJobBulkSelectable(j.status) : false;
          })
        );
      } catch {
        setJobs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [pb, pnrKey, reqs, row]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [rows, bookings, staffPhotos] = await Promise.all([
          pb.collection("guides").getFullList<Record<string, unknown>>({
            requestKey: null,
          }),
          loadGuideDayBookings(pb),
          pb
            .collection("staff_profiles")
            .getFullList<{
              id: string;
              staff_id?: string;
              photo?: string;
            }>({ requestKey: null })
            .catch(() => []),
        ]);
        if (cancelled) return;
        setDayBookings(bookings);
        const photoByStaff = new Map<string, string>();
        for (const sp of staffPhotos) {
          const sid = String(sp.staff_id || "").trim();
          const file = String(sp.photo || "").trim();
          if (!sid || !file) continue;
          const src = `/api/staff/avatar/${encodeURIComponent(sid)}?v=${encodeURIComponent(file)}`;
          photoByStaff.set(sid, src);
        }
        const byStaff = new Map<string, GuideMatchProfile>();
        for (const r of rows) {
          const staff = guides.find((g) => g.id === String(r.staff || ""));
          const profile = guideRecordToMatchProfile(r, staff);
          if (!profile) continue;
          const photo = photoByStaff.get(profile.id);
          byStaff.set(
            profile.id,
            photo ? { ...profile, avatarUrl: photo } : profile
          );
        }
        for (const g of guides) {
          if (byStaff.has(g.id)) continue;
          byStaff.set(g.id, {
            id: g.id,
            name: g.name || g.email || "Guide",
            phone: "—",
            email: g.email,
            languages: ["EN"],
            acceptsKids: true,
            acceptsCouples: true,
            maxGroupSize: 10,
            hourlyRateJpy: 3500,
            baseRate6hJpy: 0,
            baseRate8hJpy: 0,
            status: "AVAILABLE",
            avatarUrl: photoByStaff.get(g.id),
          });
        }
        setProfiles([...byStaff.values()]);
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, guides]);

  const bookingMatch = useMemo(
    () => ({
      language: reqs?.tourLanguage || null,
      paxAdults: reqs?.adults ?? 1,
      paxChildren: reqs?.children ?? 0,
      totalHours: 6,
      couplesOnly: (reqs?.adults ?? 0) === 2 && (reqs?.children ?? 0) === 0,
    }),
    [reqs]
  );

  const activeJob = jobs.find((j) => j.id === assignJobId) || null;
  const selectedJobs = useMemo(
    () => jobs.filter((j) => selectedJobIds.includes(j.id)),
    [jobs, selectedJobIds]
  );
  const activeHours = Math.max(
    1,
    Number(
      bulkAssignOpen
        ? Math.max(
            ...selectedJobs.map((j) => Number(j.duration_hours) || 6),
            6
          )
        : activeJob?.duration_hours
    ) || 6
  );
  const modalTourDate = normalizeTourDateIso(
    bulkAssignOpen
      ? selectedJobs[0]?.tour_date || row.tour_date
      : activeJob?.tour_date || row.tour_date
  );
  const selectableJobIds = useMemo(
    () =>
      jobs.filter((j) => isJobBulkSelectable(j.status)).map((j) => j.id),
    [jobs]
  );
  const allSelectableSelected =
    selectableJobIds.length > 0 &&
    selectableJobIds.every((id) => selectedJobIds.includes(id));

  const toggleSelection = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !isJobBulkSelectable(job.status)) return;
    setSelectedJobIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const selectAll = () => {
    if (allSelectableSelected) setSelectedJobIds([]);
    else setSelectedJobIds(selectableJobIds);
  };

  const run = async (jobId: string, fn: () => Promise<unknown>) => {
    setBusyId(jobId);
    setError(null);
    try {
      await fn();
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
    setBulkMsg(null);
    try {
      await fn();
      setSelectedJobIds([]);
      setBulkAssignOpen(false);
      await reload();
      await onJobsChanged?.();
      try {
        setDayBookings(await loadGuideDayBookings(pb));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkOpenBoard = () => {
    const ids = selectedJobIds.filter((id) => selectableJobIds.includes(id));
    if (ids.length === 0) return;
    void runBulk(async () => {
      for (const id of ids) {
        await postGuideJobToBoard(pb, id);
      }
      setBulkMsg(`Sent ${ids.length} day${ids.length === 1 ? "" : "s"} to the open board.`);
    });
  };

  const totalPayout = jobs.reduce(
    (sum, j) => sum + Math.max(0, Number(j.payout_jpy) || 0),
    0
  );
  const selectedPayout = selectedJobs.reduce(
    (sum, j) => sum + Math.max(0, Number(j.payout_jpy) || 0),
    0
  );
  const bulkBusy = busyId === "bulk" || saving;

  return (
    <div className="max-w-4xl space-y-4 text-xs text-white">
      <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="font-sans text-sm font-semibold tracking-wider text-[#F6A724] uppercase">
              Per-day guide dispatch
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Each tour day is its own job. Assign Guide A to Kyoto Day 1 and
              post Day 2 to the open board — never one 80-hour mega-payout.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void reload()}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold tracking-wider text-zinc-300 uppercase disabled:opacity-40"
          >
            {loading ? "Syncing…" : "Sync days"}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-[11px] text-zinc-400">
          <span>
            Jobs:{" "}
            <strong className="text-white tabular-nums">{jobs.length}</strong>
          </span>
          <span>
            Package guide pay (sum of days):{" "}
            <strong className="text-emerald-400 tabular-nums">
              ¥{totalPayout.toLocaleString("en-US")}
            </strong>
          </span>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
        {bulkMsg ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-300">
            {bulkMsg}
          </p>
        ) : null}

        {loading && jobs.length === 0 ? (
          <p className="text-zinc-500">Building day jobs from itinerary…</p>
        ) : jobs.length === 0 ? (
          <p className="text-zinc-500">
            No guided tour days found for this PNR yet. Add tours in the guest
            plan or Pricing Studio, then Sync days.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className={`inline-flex items-center gap-2 text-[11px] ${
                  selectableJobIds.length === 0
                    ? "cursor-not-allowed text-zinc-600"
                    : "cursor-pointer text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={selectAll}
                  disabled={selectableJobIds.length === 0}
                  className="h-4 w-4 rounded border-white/20 bg-black/50 text-[#075473] focus:ring-[#075473] disabled:cursor-not-allowed disabled:opacity-40"
                />
                {allSelectableSelected
                  ? "Clear selection"
                  : "Select all available days"}
              </label>
              {selectedJobIds.length > 0 ? (
                <span className="text-[10px] text-zinc-500">
                  Tip: assign Days 1–4 in one click
                </span>
              ) : selectableJobIds.length === 0 ? (
                <span className="text-[10px] text-zinc-600">
                  Offered / accepted days are locked
                </span>
              ) : null}
            </div>

            {selectedJobIds.length > 0 ? (
              <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#075473]/50 bg-[#075473]/25 p-3 backdrop-blur-md">
                <div className="text-[12px] font-bold text-white">
                  <span className="text-cyan-300">{selectedJobIds.length}</span>{" "}
                  day{selectedJobIds.length === 1 ? "" : "s"} selected
                  <span className="ml-2 font-mono text-[11px] font-normal text-zinc-300">
                    ¥{selectedPayout.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => {
                      setBulkMsg(null);
                      setAssignJobId(null);
                      setBulkAssignOpen(true);
                    }}
                    className="rounded-lg bg-[#075473] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg disabled:opacity-40"
                  >
                    Assign selected
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
                    onClick={() => setSelectedJobIds([])}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase hover:text-white disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {jobs.map((job) => {
              const status = normalizeGuideJobStatus(job.status);
              const selectable = isJobBulkSelectable(status);
              const busy = busyId === job.id || bulkBusy;
              const dateLabel = formatGuideJobDateLabel(job.tour_date);
              const checked = selectable && selectedJobIds.includes(job.id);
              return (
                <div
                  key={job.id}
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
                      onChange={() => toggleSelection(job.id)}
                      disabled={!selectable}
                      title={
                        selectable
                          ? "Select for bulk assign"
                          : "Locked — already offered or accepted"
                      }
                      aria-label={
                        selectable
                          ? `Select ${job.tour_name}`
                          : `${job.tour_name} locked (${status})`
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
                          {job.tour_name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {dateLabel}
                          {job.city ? ` · ${job.city}` : ""}
                          {" · "}
                          {Math.max(1, Number(job.duration_hours) || 6)}h
                          {" · "}
                          {Math.max(1, Number(job.pax_count) || 1)} pax
                          {job.day_index ? ` · Day ${job.day_index}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-white">
                          ¥
                          {Math.max(
                            0,
                            Number(job.payout_jpy) || 0
                          ).toLocaleString("en-US")}
                        </div>
                        <span
                          className={`mt-1 inline-block rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${jobStatusClass(status)}`}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-[11px]">
                        {job.assigned_guide_name ? (
                          <>
                            <span className="font-bold text-white">
                              {job.assigned_guide_name}
                            </span>
                            <span className="ml-2 text-zinc-500">
                              {status === "OFFERED"
                                ? "Awaiting guide accept"
                                : status === "ACCEPTED"
                                  ? "Confirmed for this day"
                                  : status}
                            </span>
                          </>
                        ) : (
                          <span className="italic text-zinc-500">
                            No guide for this day yet
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setBulkAssignOpen(false);
                            setAssignJobId(job.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#075473] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase disabled:opacity-40"
                        >
                          <Search className="h-3 w-3" />
                          Assign
                        </button>
                        <button
                          type="button"
                          disabled={busy || status === "ACCEPTED"}
                          onClick={() =>
                            void run(job.id, () =>
                              postGuideJobToBoard(pb, job.id)
                            )
                          }
                          className="rounded-lg border border-[#F6A724]/50 bg-[#F6A724]/15 px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase disabled:opacity-40"
                        >
                          Open board
                        </button>
                        {job.assigned_guide_staff_id ||
                        status === "OPEN_BOARD" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(job.id, () => clearGuideJob(pb, job.id))
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
      </div>

      {(assignJobId && activeJob) ||
      (bulkAssignOpen && selectedJobs.length > 0) ? (
        <GuideSearchModal
          pnr={pnrKey}
          booking={{
            ...bookingMatch,
            totalHours: activeHours,
          }}
          tourDate={modalTourDate}
          tourHours={activeHours}
          isNightTour={isNightTourHours(activeHours, reqs?.durationLabel)}
          guideAlreadyConfirmed={
            !bulkAssignOpen &&
            normalizeGuideJobStatus(activeJob?.status) === "ACCEPTED"
          }
          allGuides={profiles}
          dayBookings={dayBookings}
          onClose={() => {
            setAssignJobId(null);
            setBulkAssignOpen(false);
          }}
          onSelectGuide={async (guideId) => {
            const g = guides.find((x) => x.id === guideId);
            const name = g?.name || g?.email || "Guide";
            if (bulkAssignOpen) {
              const ids = selectedJobIds.filter((id) =>
                selectableJobIds.includes(id)
              );
              if (ids.length === 0) {
                setBulkAssignOpen(false);
                setError("No available days selected — offered/accepted are locked.");
                return;
              }
              await runBulk(async () => {
                for (const jobId of ids) {
                  await offerGuideJob(pb, {
                    jobId,
                    staffId: guideId,
                    staffName: name,
                  });
                }
                setBulkMsg(
                  `Offered ${ids.length} day${ids.length === 1 ? "" : "s"} to ${name}.`
                );
              });
              return;
            }
            if (!assignJobId) return;
            await run(assignJobId, () =>
              offerGuideJob(pb, {
                jobId: assignJobId,
                staffId: guideId,
                staffName: name,
              }).then(() => undefined)
            );
            setAssignJobId(null);
            try {
              setDayBookings(await loadGuideDayBookings(pb));
            } catch {
              /* ignore */
            }
          }}
        />
      ) : null}
    </div>
  );
}
