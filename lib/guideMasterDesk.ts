/**
 * Master Guide Roster & Workload Management Center — pure helpers.
 * Sources: staff (role=guide), guide_jobs, ops_payouts.
 */

import {
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type GuideJobRow,
} from "@/lib/guideJobs";
import { jpyToEur } from "@/lib/pnlLedger";
import type { OpsPayoutRow } from "@/lib/opsPayouts";
import type { StaffOption } from "@/components/staff/opsHubClient";

export type GuideJobFilter = "all" | "open" | "offered" | "accepted";

export type GuideMasterKpis = {
  activeGuides: number;
  openJobs: number;
  pendingOffers: number;
  completedAccepted: number;
};

export type GuidePayoutRow = OpsPayoutRow & {
  updated?: string;
  created?: string;
};

export type GuideWorkloadStats = {
  staffId: string;
  totalTours: number;
  upcomingTours: number;
  lastTourDate: string | null;
  lastPayoutDate: string | null;
  lastPayoutAmountJpy: number | null;
  pendingPayoutJpy: number;
  pendingPayoutEur: number | null;
};

function todayIso(): string {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isOpenGuideJob(job: GuideJobRow): boolean {
  const s = normalizeGuideJobStatus(job.status);
  return s === "OPEN_BOARD" || s === "UNASSIGNED";
}

export function isOfferedGuideJob(job: GuideJobRow): boolean {
  return normalizeGuideJobStatus(job.status) === "OFFERED";
}

export function isAcceptedOrCompletedGuideJob(job: GuideJobRow): boolean {
  const s = normalizeGuideJobStatus(job.status);
  return s === "ACCEPTED" || s === "COMPLETED";
}

export function computeGuideMasterKpis(
  guides: StaffOption[],
  jobs: GuideJobRow[]
): GuideMasterKpis {
  let openJobs = 0;
  let pendingOffers = 0;
  let completedAccepted = 0;
  for (const job of jobs) {
    if (isOpenGuideJob(job)) openJobs += 1;
    else if (isOfferedGuideJob(job)) pendingOffers += 1;
    else if (isAcceptedOrCompletedGuideJob(job)) completedAccepted += 1;
  }
  return {
    activeGuides: guides.length,
    openJobs,
    pendingOffers,
    completedAccepted,
  };
}

export function filterGuideJobs(
  jobs: GuideJobRow[],
  filter: GuideJobFilter,
  query: string
): GuideJobRow[] {
  const needle = query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filter === "open" && !isOpenGuideJob(job)) return false;
    if (filter === "offered" && !isOfferedGuideJob(job)) return false;
    if (filter === "accepted" && !isAcceptedOrCompletedGuideJob(job))
      return false;
    if (!needle) return true;
    const status = normalizeGuideJobStatus(job.status);
    const hay = [
      job.pnr,
      job.tour_name,
      job.city,
      job.assigned_guide_name,
      job.assigned_guide,
      status,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function countGuideJobsByFilter(
  jobs: GuideJobRow[]
): Record<GuideJobFilter, number> {
  const counts: Record<GuideJobFilter, number> = {
    all: jobs.length,
    open: 0,
    offered: 0,
    accepted: 0,
  };
  for (const job of jobs) {
    if (isOpenGuideJob(job)) counts.open += 1;
    else if (isOfferedGuideJob(job)) counts.offered += 1;
    else if (isAcceptedOrCompletedGuideJob(job)) counts.accepted += 1;
  }
  return counts;
}

export function jobsForGuide(
  jobs: GuideJobRow[],
  staffId: string
): GuideJobRow[] {
  const id = String(staffId || "").trim();
  if (!id) return [];
  return jobs.filter(
    (j) => String(j.assigned_guide_staff_id || "").trim() === id
  );
}

export function computeGuideWorkload(
  jobs: GuideJobRow[],
  payouts: GuidePayoutRow[],
  staffId: string,
  eurJpy?: number | null
): GuideWorkloadStats {
  const mine = jobsForGuide(jobs, staffId);
  const today = todayIso();

  let upcomingTours = 0;
  let lastTourDate: string | null = null;
  for (const job of mine) {
    const date = normalizeTourDateIso(job.tour_date);
    if (date && date >= today) upcomingTours += 1;
    if (date && (!lastTourDate || date > lastTourDate) && date < today) {
      lastTourDate = date;
    }
  }
  // If no past tour, fall back to most recent completed/accepted date (any)
  if (!lastTourDate) {
    for (const job of mine) {
      if (!isAcceptedOrCompletedGuideJob(job)) continue;
      const date = normalizeTourDateIso(job.tour_date);
      if (date && (!lastTourDate || date > lastTourDate)) lastTourDate = date;
    }
  }

  const guidePayouts = payouts.filter(
    (p) =>
      String(p.staff_id || "").trim() === staffId &&
      String(p.role || "").toLowerCase() === "guide"
  );

  let pendingPayoutJpy = 0;
  for (const p of guidePayouts) {
    const st = String(p.status || "").toLowerCase();
    if (st === "pending" || st === "hold" || !st) {
      pendingPayoutJpy += Math.max(0, Number(p.amount_jpy) || 0);
    }
  }

  const paid = guidePayouts
    .filter((p) => String(p.status || "").toLowerCase() === "paid")
    .sort((a, b) => {
      const da = String(a.updated || a.created || "");
      const db = String(b.updated || b.created || "");
      return db.localeCompare(da);
    });

  const lastPaid = paid[0] || null;
  const lastPayoutDate = lastPaid
    ? normalizeTourDateIso(lastPaid.updated || lastPaid.created) ||
      String(lastPaid.updated || lastPaid.created || "").slice(0, 10) ||
      null
    : null;
  const lastPayoutAmountJpy = lastPaid
    ? Math.max(0, Number(lastPaid.amount_jpy) || 0)
    : null;

  const pendingEur =
    pendingPayoutJpy > 0 && eurJpy != null && eurJpy > 0
      ? jpyToEur(pendingPayoutJpy, eurJpy)
      : null;

  return {
    staffId,
    totalTours: mine.length,
    upcomingTours,
    lastTourDate,
    lastPayoutDate,
    lastPayoutAmountJpy,
    pendingPayoutJpy,
    pendingPayoutEur: pendingEur,
  };
}
