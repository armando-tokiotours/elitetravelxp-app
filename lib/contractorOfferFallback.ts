/**
 * Contractor offer fallback (server-only)
 *
 * When a guide declines an OFFERED day job, or the offer ages past 48h:
 *  - status → OPEN_BOARD
 *  - clear assigned_guide_staff_id / name / relation / offered_at
 *  - log booking event
 *  - notify Ops via transactional email + OPS chat
 *
 * Idempotent: already-open board jobs with no assignee are skipped.
 */

import "server-only";

import type PocketBase from "pocketbase";
import { appendBookingLog } from "@/lib/bookingLogs";
import { sendBookingMessage } from "@/lib/bookingMessages";
import {
  dualWriteHubPrimaryGuide,
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type GuideJobRow,
} from "@/lib/guideJobs";
import { getActiveEmailConfig } from "@/lib/emailConfigStore";
import { sendTransactionalMail } from "@/lib/mail";
export const OFFER_TIMEOUT_MS = 48 * 60 * 60 * 1000;

export type OfferFallbackReason = "declined" | "expired";

export type OfferFallbackResult = {
  ok: boolean;
  skipped: boolean;
  jobId: string;
  pnr: string;
  reason: OfferFallbackReason;
  message: string;
  opsEmailed: boolean;
};

function safePnr(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseOfferedAtMs(job: GuideJobRow): number | null {
  const raw = String(job.offered_at || "").trim();
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  // Fallback: PocketBase autodate `updated` when offered_at missing (pre-migration)
  const updated = String(job.updated || "").trim();
  if (updated) {
    const t = Date.parse(updated);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

export function isGuideOfferExpired(
  job: GuideJobRow,
  nowMs = Date.now()
): boolean {
  if (normalizeGuideJobStatus(job.status) !== "OFFERED") return false;
  const offeredMs = parseOfferedAtMs(job);
  if (offeredMs == null) return false;
  return nowMs - offeredMs >= OFFER_TIMEOUT_MS;
}

async function resolveOpsNotifyEmail(): Promise<string> {
  try {
    const cfg = getActiveEmailConfig();
    const addr = String(cfg.routing?.bccRecipient || "").trim().toLowerCase();
    if (isValidEmail(addr)) return addr;
  } catch {
    /* fall through */
  }
  return "armando@tokiotours.nl";
}

async function notifyOpsOfferFallback(opts: {
  pb: PocketBase;
  pnr: string;
  job: GuideJobRow;
  reason: OfferFallbackReason;
  previousGuideName: string;
  previousGuideStaffId: string;
}): Promise<boolean> {
  const reasonLabel =
    opts.reason === "expired"
      ? "Offer expired (48h without accept)"
      : "Guide declined the offer";
  const dateLabel =
    normalizeTourDateIso(opts.job.tour_date) ||
    String(opts.job.tour_date || "TBD");
  const subject = `[Ops] Guide job → Open Board · ${opts.pnr}`;
  const text = [
    reasonLabel,
    "",
    `PNR: ${opts.pnr}`,
    `Tour: ${opts.job.tour_name || "—"}`,
    `Date: ${dateLabel}`,
    `Job: ${opts.job.job_key || opts.job.id}`,
    `Previous guide: ${opts.previousGuideName || "—"} (${opts.previousGuideStaffId || "—"})`,
    "",
    "Job returned to Open Board. Assign another guide or leave for claim.",
  ].join("\n");

  let opsEmailed = false;
  try {
    const to = await resolveOpsNotifyEmail();
    const mail = await sendTransactionalMail({
      to,
      subject,
      text,
      html: `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`,
      skipTeamBcc: true,
    });
    opsEmailed = Boolean(mail.sent);
  } catch (err) {
    console.warn(
      "[contractor-fallback] ops email failed",
      err instanceof Error ? err.message : err
    );
  }

  try {
    const hub = await opts.pb
      .collection("ops_hub")
      .getFirstListItem<{ id: string }>(`pnr="${opts.pnr}"`, {
        requestKey: null,
      });
    await sendBookingMessage(opts.pb, {
      pnr: opts.pnr,
      opsHubId: hub.id,
      channel: "OPS",
      senderName: "SYSTEM",
      senderRole: "OPS_COORDINATOR",
      topic: "GENERAL",
      message: [
        `GUIDE OFFER → OPEN BOARD`,
        reasonLabel,
        `Tour: ${opts.job.tour_name || "—"} · ${dateLabel}`,
        `Previous: ${opts.previousGuideName || "unassigned"}`,
      ].join("\n"),
    });
    await appendBookingLog(opts.pb, {
      pnr: opts.pnr,
      opsHubId: hub.id,
      actionType: "status_changed",
      details: `Guide job ${opts.job.id} → OPEN_BOARD (${opts.reason}) was=${opts.previousGuideName || "none"}`,
      staffName: "SYSTEM",
    });
  } catch (err) {
    console.warn(
      "[contractor-fallback] ops log/chat failed",
      err instanceof Error ? err.message : err
    );
  }

  return opsEmailed;
}

/**
 * Return one guide day-job to Open Board and notify Ops.
 * Safe to call from decline API or expire cron.
 */
export async function fallbackGuideOfferToOpenBoard(
  pb: PocketBase,
  opts: {
    jobId: string;
    reason: OfferFallbackReason;
    /** When declining, require this staff id owns the offer */
    staffId?: string;
    staffName?: string;
  }
): Promise<OfferFallbackResult> {
  const jobId = String(opts.jobId || "").trim();
  const empty: OfferFallbackResult = {
    ok: false,
    skipped: false,
    jobId,
    pnr: "",
    reason: opts.reason,
    message: "jobId required",
    opsEmailed: false,
  };
  if (!jobId) return empty;

  const job = await pb.collection("guide_jobs").getOne<GuideJobRow>(jobId, {
    requestKey: null,
  });
  const pnr = safePnr(job.pnr);
  const status = normalizeGuideJobStatus(job.status);

  // Idempotent: already on board / unassigned with no guide
  if (
    (status === "OPEN_BOARD" || status === "UNASSIGNED") &&
    !String(job.assigned_guide_staff_id || "").trim()
  ) {
    return {
      ok: true,
      skipped: true,
      jobId,
      pnr,
      reason: opts.reason,
      message: "Already on Open Board",
      opsEmailed: false,
    };
  }

  if (opts.reason === "declined") {
    if (status !== "OFFERED" && status !== "ACCEPTED") {
      return {
        ok: false,
        skipped: true,
        jobId,
        pnr,
        reason: opts.reason,
        message: `Job status ${status} cannot be declined`,
        opsEmailed: false,
      };
    }
    const assignee = String(job.assigned_guide_staff_id || "").trim();
    if (
      opts.staffId &&
      assignee &&
      assignee !== String(opts.staffId).trim()
    ) {
      return {
        ok: false,
        skipped: true,
        jobId,
        pnr,
        reason: opts.reason,
        message: "Not your assignment",
        opsEmailed: false,
      };
    }
  } else if (opts.reason === "expired") {
    if (status !== "OFFERED") {
      return {
        ok: true,
        skipped: true,
        jobId,
        pnr,
        reason: opts.reason,
        message: "Not an open offer",
        opsEmailed: false,
      };
    }
    if (!isGuideOfferExpired(job)) {
      return {
        ok: true,
        skipped: true,
        jobId,
        pnr,
        reason: opts.reason,
        message: "Offer still within 48h window",
        opsEmailed: false,
      };
    }
  }

  const previousGuideName = String(job.assigned_guide_name || "").trim();
  const previousGuideStaffId = String(job.assigned_guide_staff_id || "").trim();

  await pb.collection("guide_jobs").update(
    jobId,
    {
      status: "OPEN_BOARD",
      assigned_guide_staff_id: "",
      assigned_guide_name: "",
      assigned_guide: null,
      offered_at: null,
      notes: [
        String(job.notes || "").trim(),
        opts.reason === "expired"
          ? `[auto] offer expired 48h @ ${new Date().toISOString()}`
          : `[auto] declined by ${opts.staffName || previousGuideName || "guide"} @ ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000),
    },
    { requestKey: null }
  );

  try {
    await dualWriteHubPrimaryGuide(pb, pnr);
  } catch {
    /* optional dual-write */
  }

  const opsEmailed = await notifyOpsOfferFallback({
    pb,
    pnr,
    job,
    reason: opts.reason,
    previousGuideName,
    previousGuideStaffId,
  });

  return {
    ok: true,
    skipped: false,
    jobId,
    pnr,
    reason: opts.reason,
    message:
      opts.reason === "expired"
        ? "Expired offer returned to Open Board"
        : "Declined — job returned to Open Board",
    opsEmailed,
  };
}

export type ExpireOffersScanResult = {
  ok: boolean;
  scanned: number;
  expired: number;
  skipped: number;
  errors: number;
  results: OfferFallbackResult[];
};

/**
 * Scan OFFERED guide_jobs older than 48h and fall back to Open Board.
 * Hit via GET|POST /api/ops/expire-offers (manual or cron).
 */
export async function expireStaleContractorOffers(
  pb: PocketBase
): Promise<ExpireOffersScanResult> {
  const now = Date.now();
  const results: OfferFallbackResult[] = [];
  let expired = 0;
  let skipped = 0;
  let errors = 0;

  let offered: GuideJobRow[] = [];
  try {
    offered = await pb.collection("guide_jobs").getFullList<GuideJobRow>({
      filter: `status="OFFERED"`,
      sort: "tour_date,pnr",
      requestKey: null,
    });
  } catch (err) {
    console.warn(
      "[expire-offers] list failed",
      err instanceof Error ? err.message : err
    );
  }

  for (const job of offered) {
    if (!isGuideOfferExpired(job, now)) {
      skipped += 1;
      continue;
    }
    try {
      const r = await fallbackGuideOfferToOpenBoard(pb, {
        jobId: job.id,
        reason: "expired",
      });
      results.push(r);
      if (r.skipped) skipped += 1;
      else if (r.ok) expired += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      results.push({
        ok: false,
        skipped: false,
        jobId: job.id,
        pnr: safePnr(job.pnr),
        reason: "expired",
        message: err instanceof Error ? err.message : "expire failed",
        opsEmailed: false,
      });
    }
  }

  return {
    ok: true,
    scanned: offered.length,
    expired,
    skipped,
    errors,
    results,
  };
}
