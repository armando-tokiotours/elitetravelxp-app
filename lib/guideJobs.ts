/**
 * Per-day / per-tour guide dispatch jobs (guide_jobs collection).
 * Decouples multi-day PNRs into assignable day jobs.
 */

import type PocketBase from "pocketbase";
import {
  estimateGuidePayout,
  parseTourHoursLabel,
} from "@/lib/guideMatcher";
import {
  isGuideServiceItem,
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import type {
  OpsGuestRequirements,
  OpsItineraryDay,
  OpsItineraryStop,
} from "@/lib/opsGuestRequirements";
import { addDaysIso } from "@/lib/dateCascade";
import { getGuideByStaff } from "@/lib/roleProfiles";

export type GuideJobStatus =
  | "UNASSIGNED"
  | "OPEN_BOARD"
  | "OFFERED"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED";

export type GuideJobRow = {
  id: string;
  pnr: string;
  job_key: string;
  tour_date?: string;
  tour_name: string;
  city?: string;
  tour_id?: string;
  service_line_id?: string;
  duration_hours?: number;
  pax_count?: number;
  payout_jpy?: number;
  status: GuideJobStatus | string;
  assigned_guide_staff_id?: string;
  assigned_guide_name?: string;
  assigned_guide?: string;
  day_index?: number;
  notes?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

/** PocketBase dates often arrive as `YYYY-MM-DD HH:mm:ss.SSS Z` — never append T12 onto that. */
export function normalizeTourDateIso(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatGuideJobDateLabel(
  raw: unknown,
  opts?: { weekday?: boolean }
): string {
  const iso = normalizeTourDateIso(raw);
  if (!iso) return "Date TBD";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString(undefined, {
    ...(opts?.weekday !== false ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveJobDate(opts: {
  dayDate?: string | null;
  stopStart?: string | null;
  hubDate?: string | null;
  dayIndex: number;
  occ: number;
}): string {
  const fromDay = normalizeTourDateIso(opts.dayDate);
  if (fromDay) return fromDay;
  const anchor =
    normalizeTourDateIso(opts.stopStart) ||
    normalizeTourDateIso(opts.hubDate);
  if (!anchor) return "";
  const offset = Math.max(0, (opts.dayIndex || 1) - 1) + Math.max(0, opts.occ - 1);
  return offset > 0 ? addDaysIso(anchor, offset) : anchor;
}

function jobKey(parts: {
  pnr: string;
  date: string;
  tourId: string;
  title: string;
  dayIndex: number;
  occ: number;
  serviceLineId?: string;
}): string {
  const slug = String(parts.title || "tour")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  const idPart =
    parts.serviceLineId ||
    parts.tourId ||
    slug ||
    "tour";
  // occ makes duplicate same-day tours unique without random UUIDs (stable across syncs)
  return `${parts.pnr}|d${parts.dayIndex || 0}|${parts.date || "tba"}|${idPart}|#${parts.occ}`;
}

export function normalizeGuideJobStatus(
  raw?: string | null
): GuideJobStatus {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (
    v === "OPEN_BOARD" ||
    v === "OFFERED" ||
    v === "ACCEPTED" ||
    v === "REJECTED" ||
    v === "COMPLETED" ||
    v === "UNASSIGNED"
  ) {
    return v;
  }
  return "UNASSIGNED";
}

type DraftJob = {
  job_key: string;
  pnr: string;
  tour_date: string;
  tour_name: string;
  city: string;
  tour_id: string;
  service_line_id: string;
  duration_hours: number;
  pax_count: number;
  payout_jpy: number;
  day_index: number;
};

function draftFromDayTour(opts: {
  pnr: string;
  stop: OpsItineraryStop;
  day: OpsItineraryDay;
  tourId: string;
  title: string;
  hours: number;
  pax: number;
  occ: number;
  hubDate?: string | null;
  serviceLineId?: string;
}): DraftJob {
  const hours = Math.max(1, opts.hours || 6);
  const payout = estimateGuidePayout({ tourHours: hours });
  const dayIndex = Math.max(1, Number(opts.day.dayIndex) || opts.occ || 1);
  const tour_date = resolveJobDate({
    dayDate: opts.day.date,
    stopStart: opts.stop.startDate,
    hubDate: opts.hubDate,
    dayIndex,
    occ: opts.occ,
  });
  return {
    job_key: jobKey({
      pnr: opts.pnr,
      date: tour_date,
      tourId: opts.tourId,
      title: opts.title,
      dayIndex,
      occ: opts.occ,
      serviceLineId: opts.serviceLineId,
    }),
    pnr: opts.pnr,
    tour_date,
    tour_name: opts.title,
    city: opts.stop.cityName,
    tour_id: opts.tourId,
    service_line_id: opts.serviceLineId || "",
    duration_hours: hours,
    pax_count: opts.pax,
    payout_jpy: payout.totalPayoutJpy,
    day_index: dayIndex,
  };
}

/** Build draft jobs from guest itinerary + TOUR cart lines. */
export function buildGuideJobDrafts(opts: {
  pnr: string;
  reqs: OpsGuestRequirements | null;
  hub?: OpsHubRow | null;
  services?: ServiceLineItem[] | null;
}): DraftJob[] {
  const pnr = safePnr(opts.pnr);
  if (!pnr) return [];
  const pax = Math.max(
    1,
    (opts.reqs?.adults || 0) + (opts.reqs?.children || 0) || 2
  );
  const hubDate = normalizeTourDateIso(opts.hub?.tour_date);
  const drafts: DraftJob[] = [];
  const seen = new Set<string>();

  const stops = opts.reqs?.itineraryStops || [];
  for (const stop of stops) {
    for (const day of stop.days || []) {
      const tours = day.tours || [];
      if (tours.length > 0) {
        let dayTourOcc = 0;
        for (const t of tours) {
          dayTourOcc += 1;
          const title = String(t.title || "Guided experience").trim();
          const hours =
            Number(t.hours) ||
            parseTourHoursLabel(opts.reqs?.durationLabel) ||
            6;
          const d = draftFromDayTour({
            pnr,
            stop,
            day,
            tourId: String(t.tourId || ""),
            title,
            hours,
            pax,
            occ: dayTourOcc,
            hubDate,
          });
          // Collision guard (should be rare with occ)
          let key = d.job_key;
          let bump = dayTourOcc;
          while (seen.has(key)) {
            bump += 1;
            key = jobKey({
              pnr,
              date: d.tour_date,
              tourId: d.tour_id,
              title: d.tour_name,
              dayIndex: d.day_index,
              occ: bump,
              serviceLineId: d.service_line_id,
            });
          }
          d.job_key = key;
          seen.add(key);
          drafts.push(d);
        }
      } else if (day.hasGuide) {
        const d = draftFromDayTour({
          pnr,
          stop,
          day,
          tourId: "",
          title: `Guided day · ${stop.cityName}`,
          hours: parseTourHoursLabel(opts.reqs?.durationLabel) || 6,
          pax,
          occ: 1,
          hubDate,
        });
        if (!seen.has(d.job_key)) {
          seen.add(d.job_key);
          drafts.push(d);
        }
      }
    }
  }

  // Cart TOUR lines — only when itinerary produced no day jobs
  const services = opts.services || [];
  if (drafts.length === 0) {
    let cartIdx = 0;
    for (const item of services) {
      if (!isGuideServiceItem(item)) continue;
      if (item.status === "DECLINED") continue;
      cartIdx += 1;
      const title = String(item.title || "Tour").trim();
      const hours =
        parseTourHoursLabel(item.notes) ||
        parseTourHoursLabel(opts.reqs?.durationLabel) ||
        6;
      const date =
        resolveJobDate({
          dayDate: null,
          stopStart: null,
          hubDate,
          dayIndex: cartIdx,
          occ: 1,
        }) || (hubDate ? addDaysIso(hubDate, cartIdx - 1) : "");
      let key = jobKey({
        pnr,
        date,
        tourId: item.catalogSourceId || "",
        title,
        dayIndex: cartIdx,
        occ: cartIdx,
        serviceLineId: item.id,
      });
      let bump = cartIdx;
      while (seen.has(key)) {
        bump += 1;
        key = jobKey({
          pnr,
          date,
          tourId: item.catalogSourceId || "",
          title,
          dayIndex: cartIdx,
          occ: bump,
          serviceLineId: item.id,
        });
      }
      seen.add(key);
      const payout = estimateGuidePayout({ tourHours: hours });
      drafts.push({
        job_key: key,
        pnr,
        tour_date: date,
        tour_name: title,
        city: String(
          opts.hub?.primary_city ||
            opts.reqs?.itineraryStops?.[0]?.cityName ||
            ""
        ),
        tour_id: item.catalogSourceId || "",
        service_line_id: item.id,
        duration_hours: hours,
        pax_count: Math.max(1, Number(item.quantity) || pax),
        payout_jpy: payout.totalPayoutJpy,
        day_index: cartIdx,
      });
    }
  }

  // Fallback: single package job so Dispatch is never blank for guided PNRs
  if (drafts.length === 0 && opts.hub?.guide_needed !== false) {
    const date = hubDate;
    const hours = parseTourHoursLabel(opts.reqs?.durationLabel) || 6;
    const title =
      opts.reqs?.tourTitle ||
      opts.hub?.guest_summary ||
      `Guided package · ${opts.hub?.primary_city || pnr}`;
    const payout = estimateGuidePayout({ tourHours: hours });
    drafts.push({
      job_key: jobKey({
        pnr,
        date,
        tourId: "package",
        title: String(title).slice(0, 80),
        dayIndex: 1,
        occ: 1,
      }),
      pnr,
      tour_date: date,
      tour_name: String(title).slice(0, 200),
      city: String(opts.hub?.primary_city || ""),
      tour_id: "",
      service_line_id: "",
      duration_hours: hours,
      pax_count: pax,
      payout_jpy: payout.totalPayoutJpy,
      day_index: 1,
    });
  }

  return drafts.sort((a, b) => {
    const da = a.tour_date || "";
    const db = b.tour_date || "";
    if (da !== db) return da.localeCompare(db);
    return (a.day_index || 0) - (b.day_index || 0);
  });
}

export async function listGuideJobsForPnr(
  pb: PocketBase,
  pnrRaw: string
): Promise<GuideJobRow[]> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) return [];
  try {
    return await pb.collection("guide_jobs").getFullList<GuideJobRow>({
      filter: `pnr="${pnr}"`,
      sort: "tour_date,day_index,tour_name",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

/** Guest/Ops day card — privacy-masked guide for one tour day. */
export type DayGuideAssignment = {
  jobId: string;
  tourDate: string;
  dayIndex: number;
  tourName: string;
  city: string;
  status: GuideJobStatus;
  /** Privacy-masked display name (first name until unlock). */
  name: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  whatsappDigits: string | null;
  unlockMessage: string | null;
  staffId: string | null;
};

const STATUS_RANK: Record<GuideJobStatus, number> = {
  ACCEPTED: 4,
  COMPLETED: 3,
  OFFERED: 2,
  OPEN_BOARD: 1,
  REJECTED: 0,
  UNASSIGNED: 0,
};

/**
 * Best guide_job for a calendar day / day index.
 * Prefers ACCEPTED → COMPLETED → OFFERED. Date match wins over day_index.
 */
export function matchGuideJobForDay(
  jobs: GuideJobRow[],
  opts: { date?: string | null; dayIndex?: number | null }
): GuideJobRow | undefined {
  if (!jobs.length) return undefined;
  const date = normalizeTourDateIso(opts.date);
  const dayIndex =
    opts.dayIndex != null && Number.isFinite(Number(opts.dayIndex))
      ? Number(opts.dayIndex)
      : null;

  const rank = (j: GuideJobRow) =>
    STATUS_RANK[normalizeGuideJobStatus(j.status)] ?? 0;

  const byDate = date
    ? jobs.filter((j) => normalizeTourDateIso(j.tour_date) === date)
    : [];
  if (byDate.length) {
    return [...byDate].sort((a, b) => rank(b) - rank(a))[0];
  }

  if (dayIndex != null && dayIndex > 0) {
    const byIdx = jobs.filter((j) => Number(j.day_index) === dayIndex);
    if (byIdx.length) {
      return [...byIdx].sort((a, b) => rank(b) - rank(a))[0];
    }
  }

  return undefined;
}

/** Guest-visible day jobs: ACCEPTED or COMPLETED only. */
export function acceptedGuideJobs(jobs: GuideJobRow[]): GuideJobRow[] {
  return jobs.filter((j) => {
    const s = normalizeGuideJobStatus(j.status);
    return s === "ACCEPTED" || s === "COMPLETED";
  });
}

/** Lookup accepted day guide by ISO date (guest Day Services). */
export function findAcceptedDayGuide(
  dayGuides: DayGuideAssignment[] | null | undefined,
  date?: string | null
): DayGuideAssignment | undefined {
  if (!dayGuides?.length) return undefined;
  const iso = normalizeTourDateIso(date);
  if (iso) {
    const hit = dayGuides.find((g) => g.tourDate === iso && g.name);
    if (hit) return hit;
  }
  return dayGuides.find((g) => g.name) || dayGuides[0];
}

function findMatchingExistingJob(
  existing: GuideJobRow[],
  draft: DraftJob,
  claimedIds: Set<string>
): GuideJobRow | undefined {
  const byKey = existing.find(
    (j) => j.job_key === draft.job_key && !claimedIds.has(j.id)
  );
  if (byKey) return byKey;

  // Legacy / remapped keys: same day + name (+ tour/service id when present)
  const draftDate = normalizeTourDateIso(draft.tour_date);
  return existing.find((j) => {
    if (claimedIds.has(j.id)) return false;
    if (String(j.tour_name || "").trim() !== draft.tour_name) return false;
    const jDate = normalizeTourDateIso(j.tour_date);
    if (draftDate && jDate && draftDate !== jDate) return false;
    if (
      draft.service_line_id &&
      j.service_line_id &&
      draft.service_line_id === j.service_line_id
    ) {
      return true;
    }
    if (draft.tour_id && j.tour_id && draft.tour_id === j.tour_id) {
      return Number(j.day_index || 0) === Number(draft.day_index || 0);
    }
    return (
      !draft.tour_id &&
      !j.tour_id &&
      Number(j.day_index || 0) === Number(draft.day_index || 0)
    );
  });
}

/**
 * Upsert job rows from itinerary/cart. Does not wipe ACCEPTED offers.
 * Removes obsolete UNASSIGNED/OPEN_BOARD/REJECTED jobs whose keys disappeared.
 */
export async function syncGuideJobsForBooking(
  pb: PocketBase,
  opts: {
    pnr: string;
    reqs: OpsGuestRequirements | null;
    hub?: OpsHubRow | null;
    services?: ServiceLineItem[] | null;
  }
): Promise<GuideJobRow[]> {
  const pnr = safePnr(opts.pnr);
  const drafts = buildGuideJobDrafts(opts);
  const existing = await listGuideJobsForPnr(pb, pnr);
  const claimedIds = new Set<string>();
  const draftKeys = new Set(drafts.map((d) => d.job_key));

  for (const d of drafts) {
    const prev = findMatchingExistingJob(existing, d, claimedIds);
    const tourDate = normalizeTourDateIso(d.tour_date) || null;
    if (prev) {
      claimedIds.add(prev.id);
      const status = normalizeGuideJobStatus(prev.status);
      const patch: Record<string, unknown> = {
        job_key: d.job_key,
        tour_date: tourDate,
        tour_name: d.tour_name,
        city: d.city,
        tour_id: d.tour_id,
        service_line_id: d.service_line_id || prev.service_line_id || "",
        duration_hours: d.duration_hours,
        pax_count: d.pax_count,
        day_index: d.day_index,
      };
      if (
        status === "UNASSIGNED" ||
        status === "OPEN_BOARD" ||
        status === "REJECTED"
      ) {
        patch.payout_jpy = d.payout_jpy;
      }
      try {
        await pb.collection("guide_jobs").update(prev.id, patch, {
          requestKey: null,
        });
      } catch {
        // job_key collision with another row — keep existing key, still refresh fields
        const rest = { ...patch };
        delete rest.job_key;
        await pb.collection("guide_jobs").update(prev.id, rest, {
          requestKey: null,
        });
      }
    } else {
      try {
        const created = (await pb.collection("guide_jobs").create(
          {
            ...d,
            tour_date: tourDate,
            status: "UNASSIGNED",
            assigned_guide_staff_id: "",
            assigned_guide_name: "",
          },
          { requestKey: null }
        )) as GuideJobRow;
        claimedIds.add(created.id);
      } catch {
        // Unique job_key race / leftover row — update that record instead
        try {
          const hit = await pb
            .collection("guide_jobs")
            .getFirstListItem<GuideJobRow>(`job_key="${d.job_key}"`, {
              requestKey: null,
            });
          claimedIds.add(hit.id);
          draftKeys.add(hit.job_key);
          await pb.collection("guide_jobs").update(
            hit.id,
            {
              tour_date: tourDate,
              tour_name: d.tour_name,
              city: d.city,
              tour_id: d.tour_id,
              service_line_id: d.service_line_id || "",
              duration_hours: d.duration_hours,
              pax_count: d.pax_count,
              day_index: d.day_index,
              payout_jpy: d.payout_jpy,
            },
            { requestKey: null }
          );
        } catch {
          /* skip this draft */
        }
      }
    }
  }

  for (const prev of existing) {
    if (claimedIds.has(prev.id) || draftKeys.has(prev.job_key)) continue;
    const status = normalizeGuideJobStatus(prev.status);
    if (status === "ACCEPTED" || status === "OFFERED" || status === "COMPLETED") {
      continue;
    }
    try {
      await pb.collection("guide_jobs").delete(prev.id, { requestKey: null });
    } catch {
      /* ignore */
    }
  }

  return listGuideJobsForPnr(pb, pnr);
}

async function resolveGuideRelationId(
  pb: PocketBase,
  staffId: string
): Promise<string | undefined> {
  try {
    const g = await getGuideByStaff(pb, staffId);
    return g?.id;
  } catch {
    return undefined;
  }
}

async function dualWriteHubPrimaryGuide(
  pb: PocketBase,
  pnr: string
): Promise<void> {
  const jobs = await listGuideJobsForPnr(pb, pnr);
  const accepted = jobs.filter(
    (j) => normalizeGuideJobStatus(j.status) === "ACCEPTED"
  );
  const offered = jobs.filter(
    (j) => normalizeGuideJobStatus(j.status) === "OFFERED"
  );
  const primary = accepted[0] || offered[0];
  try {
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    await pb.collection("ops_hub").update(
      hub.id,
      {
        assigned_guide_id: primary?.assigned_guide_staff_id || "",
        assigned_guide: primary?.assigned_guide_name || "",
      },
      { requestKey: null }
    );
  } catch {
    /* ignore */
  }
  try {
    const { ensureDispatchRow } = await import("@/lib/opsDispatch");
    const row = await ensureDispatchRow(pb, pnr);
    const allAccepted =
      jobs.length > 0 &&
      jobs.every((j) => {
        const s = normalizeGuideJobStatus(j.status);
        return s === "ACCEPTED" || s === "COMPLETED";
      });
    const anyOffered = offered.length > 0;
    const anyOpen = jobs.some(
      (j) => normalizeGuideJobStatus(j.status) === "OPEN_BOARD"
    );
    await pb.collection("ops_dispatch").update(
      row.id,
      {
        assigned_guide_id: primary?.assigned_guide_staff_id || "",
        assigned_guide: primary?.assigned_guide_name || "",
        guide_mode: allAccepted
          ? "claimed"
          : anyOffered
            ? "direct"
            : anyOpen
              ? "open"
              : "unassigned",
        guide_response: allAccepted
          ? "accepted"
          : anyOffered
            ? "pending"
            : "none",
        guide_board_visible: anyOpen,
      },
      { requestKey: null }
    );
  } catch {
    /* ignore */
  }
}

export async function offerGuideJob(
  pb: PocketBase,
  opts: {
    jobId: string;
    staffId: string;
    staffName: string;
  }
): Promise<GuideJobRow> {
  const guideRel = await resolveGuideRelationId(pb, opts.staffId);
  const updated = (await pb.collection("guide_jobs").update(
    opts.jobId,
    {
      status: "OFFERED",
      assigned_guide_staff_id: opts.staffId,
      assigned_guide_name: opts.staffName,
      ...(guideRel ? { assigned_guide: guideRel } : {}),
    },
    { requestKey: null }
  )) as GuideJobRow;
  await dualWriteHubPrimaryGuide(pb, updated.pnr);
  return updated;
}

export async function postGuideJobToBoard(
  pb: PocketBase,
  jobId: string
): Promise<GuideJobRow> {
  const updated = (await pb.collection("guide_jobs").update(
    jobId,
    {
      status: "OPEN_BOARD",
      assigned_guide_staff_id: "",
      assigned_guide_name: "",
      assigned_guide: null,
    },
    { requestKey: null }
  )) as GuideJobRow;
  await dualWriteHubPrimaryGuide(pb, updated.pnr);
  return updated;
}

export async function clearGuideJob(
  pb: PocketBase,
  jobId: string
): Promise<GuideJobRow> {
  const updated = (await pb.collection("guide_jobs").update(
    jobId,
    {
      status: "UNASSIGNED",
      assigned_guide_staff_id: "",
      assigned_guide_name: "",
      assigned_guide: null,
    },
    { requestKey: null }
  )) as GuideJobRow;
  await dualWriteHubPrimaryGuide(pb, updated.pnr);
  return updated;
}

export async function acceptGuideJob(
  pb: PocketBase,
  opts: { jobId: string; staffId: string; staffName: string }
): Promise<GuideJobRow> {
  const job = await pb.collection("guide_jobs").getOne<GuideJobRow>(opts.jobId, {
    requestKey: null,
  });
  const status = normalizeGuideJobStatus(job.status);
  if (status === "OFFERED") {
    if (
      job.assigned_guide_staff_id &&
      job.assigned_guide_staff_id !== opts.staffId
    ) {
      throw new Error("This day is offered to another guide");
    }
  } else if (status !== "OPEN_BOARD") {
    throw new Error("Job is not open for acceptance");
  }
  const guideRel = await resolveGuideRelationId(pb, opts.staffId);
  const updated = (await pb.collection("guide_jobs").update(
    opts.jobId,
    {
      status: "ACCEPTED",
      assigned_guide_staff_id: opts.staffId,
      assigned_guide_name: opts.staffName,
      ...(guideRel ? { assigned_guide: guideRel } : {}),
    },
    { requestKey: null }
  )) as GuideJobRow;
  await dualWriteHubPrimaryGuide(pb, updated.pnr);
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr: updated.pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "guide",
    });
  } catch {
    /* ignore */
  }
  return updated;
}

export async function refuseGuideJobDay(
  pb: PocketBase,
  opts: { jobId: string; staffId: string }
): Promise<GuideJobRow> {
  const job = await pb.collection("guide_jobs").getOne<GuideJobRow>(opts.jobId, {
    requestKey: null,
  });
  if (
    job.assigned_guide_staff_id &&
    job.assigned_guide_staff_id !== opts.staffId
  ) {
    throw new Error("Not your assignment");
  }
  const updated = (await pb.collection("guide_jobs").update(
    opts.jobId,
    {
      status: "REJECTED",
      assigned_guide_staff_id: "",
      assigned_guide_name: "",
      assigned_guide: null,
    },
    { requestKey: null }
  )) as GuideJobRow;
  await dualWriteHubPrimaryGuide(pb, updated.pnr);
  return updated;
}

export async function listOpenBoardGuideJobs(
  pb: PocketBase
): Promise<GuideJobRow[]> {
  try {
    return await pb.collection("guide_jobs").getFullList<GuideJobRow>({
      filter: `status="OPEN_BOARD"`,
      sort: "tour_date,pnr",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

export async function listGuideJobsForStaff(
  pb: PocketBase,
  staffId: string
): Promise<GuideJobRow[]> {
  const id = String(staffId || "").trim().replace(/"/g, "");
  if (!id) return [];
  try {
    return await pb.collection("guide_jobs").getFullList<GuideJobRow>({
      filter: `assigned_guide_staff_id="${id}"`,
      sort: "tour_date,pnr",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

/** Services from ops_hub.extras for job sync. */
export function servicesFromHub(hub?: OpsHubRow | null): ServiceLineItem[] {
  if (!hub) return [];
  return parseOpsHubExtras(hub.extras).agent_services || [];
}
