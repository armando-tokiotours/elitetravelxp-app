"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import {
  formatGuideJobDateLabel,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type GuideJobRow,
} from "@/lib/guideJobs";
import {
  computeGuideMasterKpis,
  computeGuideWorkload,
  countGuideJobsByFilter,
  filterGuideJobs,
  jobsForGuide,
  type GuideJobFilter,
  type GuideMasterKpis,
  type GuidePayoutRow,
  type GuideWorkloadStats,
} from "@/lib/guideMasterDesk";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { useTeamAuth } from "@/store/useTeamAuth";
import {
  loadStaffByRole,
  OpsStatusBadge,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import {
  StaffPortalShell,
  STAFF_PORTAL_REFRESH_EVENT,
} from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";

const FILTER_TABS: { id: GuideJobFilter; label: string }[] = [
  { id: "all", label: "All Jobs" },
  { id: "open", label: "Open / Unassigned" },
  { id: "offered", label: "Offered / Pending Approval" },
  { id: "accepted", label: "Accepted / Completed" },
];

/**
 * Super User Guide Dispatch & Workload Management Center.
 * Sources: staff (role=guide) + guide_jobs + ops_payouts.
 */
export function MasterGuideRosterDesk() {
  return (
    <StaffPortalShell
      title="Guide Dispatch & Workload"
      allow={canAccessOpsBoard}
      wide
    >
      <MasterGuideRosterInner />
    </StaffPortalShell>
  );
}

function MasterGuideRosterInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [guides, setGuides] = useState<StaffOption[]>([]);
  const [jobs, setJobs] = useState<GuideJobRow[]>([]);
  const [payouts, setPayouts] = useState<GuidePayoutRow[]>([]);
  const [eurJpy, setEurJpy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GuideJobFilter>("all");
  const [q, setQ] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const forexPromise = fetch("/api/ops/forex")
        .then(async (res) => {
          const json = (await res.json()) as {
            ok?: boolean;
            pairs?: { pair: string; rate: number }[];
          };
          return json;
        })
        .catch(() => ({ ok: false as const, pairs: [] as { pair: string; rate: number }[] }));

      const [staffList, jobList, payoutList, fx] = await Promise.all([
        loadStaffByRole(pb, "guide"),
        pb
          .collection("guide_jobs")
          .getFullList<GuideJobRow>({
            sort: "tour_date,pnr",
            requestKey: null,
          })
          .catch(() => [] as GuideJobRow[]),
        pb
          .collection("ops_payouts")
          .getFullList<GuidePayoutRow>({
            filter: 'role="guide"',
            sort: "-updated",
            requestKey: null,
          })
          .catch(() => [] as GuidePayoutRow[]),
        forexPromise,
      ]);
      setGuides(staffList);
      setJobs(jobList);
      setPayouts(payoutList);
      setEurJpy(
        fx.pairs?.find((p) => p.pair === "EUR/JPY")?.rate ?? null
      );
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
    window.addEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(STAFF_PORTAL_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const kpis = useMemo(
    () => computeGuideMasterKpis(guides, jobs),
    [guides, jobs]
  );

  const filterCounts = useMemo(() => countGuideJobsByFilter(jobs), [jobs]);

  const jobsByGuide = useMemo(() => {
    const map = new Map<string, GuideJobRow[]>();
    for (const job of jobs) {
      const id = String(job.assigned_guide_staff_id || "").trim();
      if (!id) continue;
      const list = map.get(id) || [];
      list.push(job);
      map.set(id, list);
    }
    return map;
  }, [jobs]);

  const filteredJobs = useMemo(
    () => filterGuideJobs(jobs, filter, q),
    [jobs, filter, q]
  );

  const selectedGuide =
    guides.find((g) => g.id === selectedGuideId) || null;

  const selectedWorkload = useMemo(() => {
    if (!selectedGuideId) return null;
    return computeGuideWorkload(jobs, payouts, selectedGuideId, eurJpy);
  }, [jobs, payouts, selectedGuideId, eurJpy]);

  const selectedGuideJobs = useMemo(() => {
    if (!selectedGuideId) return [];
    return jobsForGuide(jobs, selectedGuideId).sort((a, b) => {
      const da = normalizeTourDateIso(a.tour_date) || "";
      const db = normalizeTourDateIso(b.tour_date) || "";
      return db.localeCompare(da);
    });
  }, [jobs, selectedGuideId]);

  return (
    <div className="space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#075473] uppercase">
            Super User · Guide dispatch
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Cross-booking roster and day jobs (
            <code className="text-zinc-300">staff</code> +{" "}
            <code className="text-zinc-300">guide_jobs</code> +{" "}
            <code className="text-zinc-300">ops_payouts</code>
            ). Assign from a booking inspector.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Refresh
        </button>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <GuideKpiBar kpis={kpis} />

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
        <BoxGradingGlow />
        <div className="relative z-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <UserCircle className="h-4 w-4 text-[#7dd3fc]" />
            Guide roster
            <span className="text-[11px] font-normal text-zinc-500">
              Click a guide for workload intelligence
            </span>
          </h2>
          {loading && guides.length === 0 ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : guides.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No active guide staff yet. Invite guides from Team Access /
              Users.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {guides.map((g) => {
                const mine = jobsByGuide.get(g.id) || [];
                const active = mine.filter((j) => {
                  const s = normalizeGuideJobStatus(j.status);
                  return s === "OFFERED" || s === "ACCEPTED";
                }).length;
                const selected = selectedGuideId === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedGuideId((prev) =>
                          prev === g.id ? null : g.id
                        )
                      }
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-[#075473]/60 bg-[#075473]/25"
                          : "border-zinc-800 bg-zinc-950/40 hover:border-white/15 hover:bg-white/5"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-white">
                        {g.name || g.email}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {g.email}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {active} active · {mine.length} total
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="shrink-0 text-[11px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Master jobs
          </h2>
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/25 p-0.5">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              const count = filterCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition ${
                    active
                      ? "bg-[#075473] text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 tabular-nums ${
                      active ? "text-white/70" : "text-zinc-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search PNR, tour, guide…"
          className="w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
        />
      </div>

      <div
        className={`grid grid-cols-1 gap-3 ${
          selectedGuide ? "lg:grid-cols-12 lg:items-start" : ""
        }`}
      >
        <section
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4 ${
            selectedGuide ? "lg:col-span-7 xl:col-span-8" : ""
          }`}
        >
          <BoxGradingGlow />
          <div className="relative z-10">
            <p className="mb-3 text-[11px] text-zinc-500">
              Showing {filteredJobs.length}
              {loading ? " · refreshing…" : ""}
            </p>
            {loading && jobs.length === 0 ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : filteredJobs.length === 0 ? (
              <p className="text-sm text-zinc-500">No jobs match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                    <tr className="border-b border-zinc-800">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">PNR</th>
                      <th className="px-2 py-2">Tour</th>
                      <th className="px-2 py-2">Guide</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b border-zinc-900/80 text-zinc-300"
                      >
                        <td className="px-2 py-2 whitespace-nowrap">
                          {formatGuideJobDateLabel(job.tour_date)}
                        </td>
                        <td className="px-2 py-2 font-mono">
                          <Link
                            href={`/ops?pnr=${encodeURIComponent(job.pnr)}`}
                            className="text-[#7dd3fc] hover:underline"
                          >
                            {job.pnr}
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          <span className="line-clamp-2">{job.tour_name}</span>
                          {job.city ? (
                            <span className="mt-0.5 block text-[10px] text-zinc-500">
                              {job.city}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          {job.assigned_guide_staff_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedGuideId(
                                  String(job.assigned_guide_staff_id)
                                )
                              }
                              className="text-left text-[#7dd3fc] hover:underline"
                            >
                              {job.assigned_guide_name ||
                                job.assigned_guide ||
                                "Guide"}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <OpsStatusBadge
                            status={normalizeGuideJobStatus(job.status)}
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          ¥{Number(job.payout_jpy || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {selectedGuide && selectedWorkload ? (
          <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 lg:col-span-5 xl:col-span-4">
            <BoxGradingGlow />
            <GuideIntelligenceDrawer
              guide={selectedGuide}
              stats={selectedWorkload}
              jobs={selectedGuideJobs}
              onClose={() => setSelectedGuideId(null)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function GuideKpiBar({ kpis }: { kpis: GuideMasterKpis }) {
  const items: {
    label: string;
    value: string;
    icon: ReactNode;
    accent?: "warn" | "ok";
  }[] = [
    {
      label: "Total Active Roster Guides",
      value: String(kpis.activeGuides),
      icon: <Users className="h-3.5 w-3.5" strokeWidth={2} />,
    },
    {
      label: "Open / Unassigned Tour Jobs",
      value: String(kpis.openJobs),
      icon: <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: kpis.openJobs > 0 ? "warn" : undefined,
    },
    {
      label: "Pending Offer Approvals",
      value: String(kpis.pendingOffers),
      icon: <UserCircle className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: kpis.pendingOffers > 0 ? "warn" : undefined,
    },
    {
      label: "Completed / Accepted Tours",
      value: String(kpis.completedAccepted),
      icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />,
      accent: "ok",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70 px-2 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-md sm:px-3">
      <BoxGradingGlow />
      <div className="relative z-10 flex flex-wrap items-stretch divide-x divide-white/5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[140px] flex-1 items-center gap-2.5 px-3 py-1.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#7ec8e3]">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
                {item.label}
              </p>
              <p
                className={`font-mono text-sm font-semibold tabular-nums ${
                  item.accent === "warn"
                    ? "text-amber-300"
                    : item.accent === "ok"
                      ? "text-emerald-300"
                      : "text-white"
                }`}
              >
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuideIntelligenceDrawer({
  guide,
  stats,
  jobs,
  onClose,
}: {
  guide: StaffOption;
  stats: GuideWorkloadStats;
  jobs: GuideJobRow[];
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 flex max-h-[min(80vh,820px)] flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Guide intelligence
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-white">
            {guide.name || guide.email}
          </h3>
          <p className="truncate text-[11px] text-zinc-500">{guide.email}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
          aria-label="Close guide drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        <StatTile label="Total tours" value={String(stats.totalTours)} />
        <StatTile
          label="Upcoming tours"
          value={String(stats.upcomingTours)}
          accent={stats.upcomingTours > 0 ? "sky" : undefined}
        />
        <StatTile
          label="Last tour date"
          value={
            stats.lastTourDate
              ? formatGuideJobDateLabel(stats.lastTourDate, { weekday: false })
              : "—"
          }
        />
        <StatTile
          label="Last payout"
          value={
            stats.lastPayoutDate
              ? `${formatGuideJobDateLabel(stats.lastPayoutDate, { weekday: false })}${
                  stats.lastPayoutAmountJpy != null
                    ? ` · ¥${stats.lastPayoutAmountJpy.toLocaleString()}`
                    : ""
                }`
              : "—"
          }
        />
        <StatTile
          label="Pending payout (JPY)"
          value={`¥${stats.pendingPayoutJpy.toLocaleString()}`}
          accent={stats.pendingPayoutJpy > 0 ? "amber" : undefined}
        />
        <StatTile
          label="Pending payout (EUR)"
          value={
            stats.pendingPayoutEur != null
              ? `€${stats.pendingPayoutEur.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
          accent={
            stats.pendingPayoutEur != null && stats.pendingPayoutEur > 0
              ? "amber"
              : undefined
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/5 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          Assigned jobs
        </p>
        {jobs.length === 0 ? (
          <p className="text-xs text-zinc-500">No jobs assigned to this guide.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.slice(0, 12).map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/ops?pnr=${encodeURIComponent(job.pnr)}`}
                    className="font-mono text-[11px] text-[#7dd3fc] hover:underline"
                  >
                    {job.pnr}
                  </Link>
                  <OpsStatusBadge
                    status={normalizeGuideJobStatus(job.status)}
                  />
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-300">
                  {job.tour_name}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {formatGuideJobDateLabel(job.tour_date)} · ¥
                  {Number(job.payout_jpy || 0).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sky" | "amber";
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/25 px-2.5 py-2">
      <p className="text-[9px] font-bold tracking-[0.12em] text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xs font-semibold tabular-nums ${
          accent === "sky"
            ? "text-[#7dd3fc]"
            : accent === "amber"
              ? "text-amber-300"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
