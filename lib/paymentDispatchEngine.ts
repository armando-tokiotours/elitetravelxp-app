/**
 * Payment Confirmation Dispatch Engine (server-only)
 *
 * When guest payment hits 30%+ deposit or 100% full:
 *  - Email assigned guide & driver (lock calendar dates)
 *  - Ticketer dashboard only: ticket_status → needed (proceed to purchase)
 *  - Idempotent via ops_hub.extras.payment_dispatch flags
 *
 * Triggered from /api/payments/record and optional Ops “Notify & Lock Dates”.
 * Client UI must import helpers from paymentDispatchFlags — not this file.
 */

import "server-only";

import type PocketBase from "pocketbase";
import {
  isTicketServiceItem,
  parseOpsHubExtras,
} from "@/lib/agentServices";
import { appendBookingLog } from "@/lib/bookingLogs";
import { sendBookingMessage } from "@/lib/bookingMessages";
import { sendTransactionalMail } from "@/lib/mail";
import { ensureDispatchRow } from "@/lib/opsDispatch";
import { updateTicketsByPnr } from "@/lib/opsTickets";
import {
  detectPaymentDispatchThreshold,
  readPaymentDispatchFlags,
  type PaymentDispatchExtras,
  type PaymentDispatchLogEntry,
} from "@/lib/paymentDispatchFlags";
import {
  resolvePaymentDispatchTemplate,
  templateIdFor,
  type PaymentDispatchThreshold,
} from "@/lib/paymentDispatchTemplates";
import { getDriverByStaff, getGuideByStaff } from "@/lib/roleProfiles";

export type {
  PaymentDispatchExtras,
  PaymentDispatchLogEntry,
} from "@/lib/paymentDispatchFlags";
export {
  detectPaymentDispatchThreshold,
  readPaymentDispatchFlags,
} from "@/lib/paymentDispatchFlags";

export type PaymentDispatchResult = {
  ok: boolean;
  pnr: string;
  threshold: PaymentDispatchThreshold | null;
  alreadySent: boolean;
  guideEmailed: boolean;
  driverEmailed: boolean;
  ticketsUpdated: boolean;
  message: string;
  /** Bulk journey: unique guides/drivers emailed across day jobs / legs */
  guidesEmailedCount?: number;
  driversEmailedCount?: number;
  scope?: "primary" | "bulk";
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

export function mergePaymentDispatchFlag(
  existingExtras: unknown,
  threshold: PaymentDispatchThreshold,
  entry: PaymentDispatchLogEntry
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (typeof existingExtras === "string") {
    try {
      base = JSON.parse(existingExtras) as Record<string, unknown>;
    } catch {
      base = {};
    }
  } else if (existingExtras && typeof existingExtras === "object") {
    base = { ...(existingExtras as Record<string, unknown>) };
  }
  const parsed = parseOpsHubExtras(existingExtras);
  const prev = readPaymentDispatchFlags(existingExtras);
  return {
    ...base,
    agent_services: parsed.agent_services || base.agent_services || [],
    final_approved_price:
      parsed.final_approved_price ?? base.final_approved_price ?? null,
    price_mode: parsed.price_mode ?? base.price_mode,
    pending_discount_request:
      parsed.pending_discount_request ?? base.pending_discount_request ?? null,
    payment_dispatch: {
      ...prev,
      [threshold]: entry,
    } satisfies PaymentDispatchExtras,
  };
}

type HubPaymentFields = {
  id: string;
  pnr: string;
  tour_date?: string | null;
  end_date?: string | null;
  guest_summary?: string | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  tickets_needed?: boolean | null;
  ticket_status?: string | null;
  assigned_guide_id?: string | null;
  assigned_guide?: string | null;
  assigned_driver_id?: string | null;
  assigned_driver?: string | null;
  extras?: unknown;
};

async function resolveStaffEmail(
  pb: PocketBase,
  staffId: string,
  guideFallback?: string | null
): Promise<{ email: string; name: string }> {
  const id = String(staffId || "").trim();
  if (!id) return { email: "", name: "" };
  try {
    const staff = await pb.collection("staff").getOne<{
      email?: string;
      name?: string;
    }>(id, { requestKey: null });
    const email = String(staff.email || guideFallback || "")
      .trim()
      .toLowerCase();
    const name = String(staff.name || "").trim();
    return { email, name };
  } catch {
    const email = String(guideFallback || "")
      .trim()
      .toLowerCase();
    return { email, name: "" };
  }
}

async function emailAssignee(opts: {
  role: "guide" | "driver";
  threshold: PaymentDispatchThreshold;
  to: string;
  name: string;
  pnr: string;
  guestName: string;
  tourDate: string | null;
}): Promise<boolean> {
  if (!isValidEmail(opts.to)) return false;
  const thresholdLabel =
    opts.threshold === "full_100" ? "100% paid" : "30%+ deposit";
  const tpl = resolvePaymentDispatchTemplate(
    templateIdFor(opts.role, opts.threshold),
    {
      pnr: opts.pnr,
      guestName: opts.guestName,
      tourDate: opts.tourDate,
      assigneeName: opts.name || opts.role,
      thresholdLabel,
    }
  );
  const mail = await sendTransactionalMail({
    to: opts.to,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
  return Boolean(mail.sent);
}

/**
 * Run dispatch for the highest unmet threshold (or a forced threshold).
 * Idempotent: skips email/ticket side-effects when extras.payment_dispatch[threshold] exists
 * unless force=true (manual Ops retry).
 */
export async function runPaymentConfirmationDispatch(
  pb: PocketBase,
  opts: {
    pnr: string;
    source?: "auto" | "manual";
    force?: boolean;
    /** When set, only fire this threshold (must still be met unless force). */
    threshold?: PaymentDispatchThreshold | "auto";
    /**
     * primary = hub/dispatch primary guide+driver (default).
     * bulk = every assigned guide_jobs day + driver_dispatch leg for the PNR.
     */
    scope?: "primary" | "bulk";
    staffName?: string;
    staffId?: string;
  }
): Promise<PaymentDispatchResult> {
  const pnr = safePnr(opts.pnr);
  const source = opts.source || "auto";
  const scope = opts.scope === "bulk" ? "bulk" : "primary";
  const empty: PaymentDispatchResult = {
    ok: false,
    pnr,
    threshold: null,
    alreadySent: false,
    guideEmailed: false,
    driverEmailed: false,
    ticketsUpdated: false,
    message: "pnr required",
    scope,
  };
  if (!pnr) return empty;

  const hub = await pb.collection("ops_hub").getFirstListItem<HubPaymentFields>(
    `pnr="${pnr}"`,
    { requestKey: null }
  );

  const met = detectPaymentDispatchThreshold(hub);
  if (!met && !opts.force) {
    return {
      ...empty,
      ok: true,
      message: "Payment has not reached 30% deposit or full payment yet.",
    };
  }

  const threshold: PaymentDispatchThreshold | null =
    opts.threshold && opts.threshold !== "auto"
      ? opts.threshold
      : met;

  if (!threshold) {
    return {
      ...empty,
      ok: true,
      message: "Payment has not reached 30% deposit or full payment yet.",
    };
  }

  if (
    !opts.force &&
    opts.threshold === "full_100" &&
    met !== "full_100"
  ) {
    return {
      ...empty,
      ok: true,
      threshold,
      message: `Threshold full_100 not met yet (current: ${met || "none"}).`,
    };
  }

  // Queue unmet thresholds (deposit first, then full). Force re-sends one target.
  const flags = readPaymentDispatchFlags(hub.extras);
  const queue: PaymentDispatchThreshold[] = [];

  if (opts.force && opts.threshold && opts.threshold !== "auto") {
    queue.push(opts.threshold);
  } else if (opts.force) {
    if (met) queue.push(met);
    else queue.push(threshold);
  } else {
    if (
      (met === "deposit_30" || met === "full_100") &&
      !flags.deposit_30
    ) {
      queue.push("deposit_30");
    }
    if (met === "full_100" && !flags.full_100) {
      queue.push("full_100");
    }
    if (opts.threshold && opts.threshold !== "auto") {
      const filtered = queue.filter((t) => t === opts.threshold);
      queue.length = 0;
      queue.push(...filtered);
    }
  }

  if (queue.length === 0) {
    return {
      ok: true,
      pnr,
      threshold,
      alreadySent: true,
      guideEmailed: false,
      driverEmailed: false,
      ticketsUpdated: false,
      message: `${threshold} dispatch already sent.`,
    };
  }

  let guestName = "";
  try {
    const lead = await pb
      .collection("bookings_and_leads")
      .getFirstListItem<{ full_name?: string; name?: string }>(
        `booking_ref="${pnr}"`,
        { requestKey: null }
      );
    guestName = String(lead.full_name || lead.name || "").trim();
  } catch {
    guestName = String(hub.guest_summary || "")
      .split(/[·|]/)[0]
      ?.trim() || "Guest";
  }

  let guideEmailed = false;
  let driverEmailed = false;
  let ticketsUpdated = false;
  let lastThreshold: PaymentDispatchThreshold = queue[queue.length - 1];
  let currentExtras = hub.extras;

  const dispatch = await ensureDispatchRow(pb, pnr).catch(() => null);

  type AssigneeTarget = {
    staffId: string;
    name: string;
    email: string;
    tourDate: string | null;
  };

  const guideTargets: AssigneeTarget[] = [];
  const driverTargets: AssigneeTarget[] = [];
  const seenGuide = new Set<string>();
  const seenDriver = new Set<string>();

  const pushGuide = async (
    staffIdRaw: string,
    nameHint: string,
    tourDate: string | null
  ) => {
    const staffId = String(staffIdRaw || "").trim();
    if (!staffId || seenGuide.has(staffId)) return;
    seenGuide.add(staffId);
    const guideProfile = await getGuideByStaff(pb, staffId);
    const resolved = await resolveStaffEmail(
      pb,
      staffId,
      guideProfile?.email
    );
    guideTargets.push({
      staffId,
      name:
        nameHint ||
        resolved.name ||
        String(guideProfile?.full_name || "") ||
        "Guide",
      email: resolved.email,
      tourDate,
    });
  };

  const pushDriver = async (
    staffIdRaw: string,
    nameHint: string,
    tourDate: string | null
  ) => {
    const staffId = String(staffIdRaw || "").trim();
    if (!staffId || seenDriver.has(staffId)) return;
    seenDriver.add(staffId);
    const driverProfile = await getDriverByStaff(pb, staffId);
    const resolved = await resolveStaffEmail(pb, staffId, null);
    driverTargets.push({
      staffId,
      name:
        nameHint ||
        resolved.name ||
        String(driverProfile?.full_name || "") ||
        "Driver",
      email: resolved.email,
      tourDate,
    });
  };

  if (scope === "bulk") {
    try {
      const { listGuideJobsForPnr, normalizeGuideJobStatus } =
        await import("@/lib/guideJobs");
      const jobs = await listGuideJobsForPnr(pb, pnr);
      for (const job of jobs) {
        const st = normalizeGuideJobStatus(job.status);
        if (st !== "OFFERED" && st !== "ACCEPTED" && st !== "COMPLETED") {
          continue;
        }
        await pushGuide(
          String(job.assigned_guide_staff_id || ""),
          String(job.assigned_guide_name || ""),
          job.tour_date ? String(job.tour_date) : null
        );
      }
    } catch (err) {
      console.warn(
        "[payment-dispatch] bulk guide_jobs failed",
        err instanceof Error ? err.message : err
      );
    }
    try {
      const { parseDriverDispatchLegs } = await import("@/lib/driverDispatch");
      const legs = parseDriverDispatchLegs(hub.extras);
      for (const leg of legs) {
        if (!String(leg.assignedDriverId || "").trim()) continue;
        await pushDriver(
          leg.assignedDriverId || "",
          leg.assignedDriverName || "",
          null
        );
      }
    } catch (err) {
      console.warn(
        "[payment-dispatch] bulk driver_dispatch failed",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Always include PNR-level primary assignees (covers single-day / no day jobs)
  await pushGuide(
    String(dispatch?.assigned_guide_id || hub.assigned_guide_id || ""),
    String(dispatch?.assigned_guide || hub.assigned_guide || ""),
    hub.tour_date ? String(hub.tour_date) : null
  );
  await pushDriver(
    String(dispatch?.assigned_driver_id || hub.assigned_driver_id || ""),
    String(dispatch?.assigned_driver || hub.assigned_driver || ""),
    hub.tour_date ? String(hub.tour_date) : null
  );

  let guidesEmailedCount = 0;
  let driversEmailedCount = 0;

  for (const th of queue) {
    lastThreshold = th;
    const already = readPaymentDispatchFlags(currentExtras)[th];
    if (already && !opts.force) continue;

    let gOk = false;
    let guidesThis = 0;
    for (const g of guideTargets) {
      const sent = await emailAssignee({
        role: "guide",
        threshold: th,
        to: g.email,
        name: g.name,
        pnr,
        guestName,
        tourDate: g.tourDate || (hub.tour_date ? String(hub.tour_date) : null),
      });
      if (sent) {
        gOk = true;
        guidesThis += 1;
      }
    }
    if (gOk) guideEmailed = true;
    guidesEmailedCount = Math.max(guidesEmailedCount, guidesThis);

    let dOk = false;
    let driversThis = 0;
    for (const d of driverTargets) {
      const sent = await emailAssignee({
        role: "driver",
        threshold: th,
        to: d.email,
        name: d.name,
        pnr,
        guestName,
        tourDate: d.tourDate || (hub.tour_date ? String(hub.tour_date) : null),
      });
      if (sent) {
        dOk = true;
        driversThis += 1;
      }
    }
    if (dOk) driverEmailed = true;
    driversEmailedCount = Math.max(driversEmailedCount, driversThis);

    // Ticketer: dashboard notice only (no external email) when tickets apply
    const ticketStatus = String(hub.ticket_status || "").toLowerCase();
    const needsTickets =
      hub.tickets_needed === true ||
      ticketStatus === "needed" ||
      ticketStatus === "ordered" ||
      hasTicketProcurementLines(hub.extras);

    if (needsTickets) {
      const label =
        th === "full_100" ? "100% paid" : "30%+ deposit secured";
      try {
        if (ticketStatus !== "ordered" && ticketStatus !== "done") {
          await updateTicketsByPnr(pb, pnr, {
            ticket_status: "needed",
            ticket_notes: `Payment dispatch (${label}): proceed to purchase.`,
          });
          await pb.collection("ops_hub").update(
            hub.id,
            { tickets_needed: true, ticket_status: "needed" },
            { requestKey: null }
          );
          ticketsUpdated = true;
        }
        await sendBookingMessage(pb, {
          pnr,
          opsHubId: hub.id,
          channel: "TICKETS",
          senderName: "SYSTEM",
          senderRole: "OPS_COORDINATOR",
          topic: "TICKETS",
          message: [
            `PROCEED TO PURCHASE`,
            `PNR: ${pnr}`,
            `Payment: ${label}`,
            `Status: ticket_status=needed — buy tickets now (dashboard notice only).`,
          ].join("\n"),
        });
        ticketsUpdated = true;
      } catch (err) {
        console.warn(
          "[payment-dispatch] ticketer update failed",
          err instanceof Error ? err.message : err
        );
      }
    }

    const entry: PaymentDispatchLogEntry = {
      at: new Date().toISOString(),
      source,
      guideEmailed: gOk,
      driverEmailed: dOk,
      ticketsUpdated,
      skipped:
        guideTargets.length === 0 && driverTargets.length === 0
          ? "no guide/driver assigned"
          : undefined,
    };
    currentExtras = mergePaymentDispatchFlag(currentExtras, th, entry);
    await pb.collection("ops_hub").update(
      hub.id,
      { extras: currentExtras, is_read: false },
      { requestKey: null }
    );

    try {
      await appendBookingLog(pb, {
        pnr,
        opsHubId: hub.id,
        actionType: "payment_sent",
        details: `Payment dispatch ${th} (${scope}): guides=${guidesEmailedCount} drivers=${driversEmailedCount} tickets=${ticketsUpdated}`,
        staffId: opts.staffId || null,
        staffName: opts.staffName || "SYSTEM",
      });
    } catch {
      /* optional */
    }
  }

  return {
    ok: true,
    pnr,
    threshold: lastThreshold,
    alreadySent: false,
    guideEmailed,
    driverEmailed,
    ticketsUpdated,
    guidesEmailedCount,
    driversEmailedCount,
    scope,
    message:
      scope === "bulk"
        ? `Bulk dispatched ${queue.join(" → ")} · ${guidesEmailedCount} guide(s) · ${driversEmailedCount} driver(s).`
        : `Dispatched ${queue.join(" → ")}.`,
  };
}

function hasTicketProcurementLines(extras: unknown): boolean {
  const lines = parseOpsHubExtras(extras).agent_services || [];
  return lines.some((item) => isTicketServiceItem(item));
}

/** Fire-and-forget safe wrapper for payment webhook path. */
export async function maybeAutoDispatchAfterPayment(
  pb: PocketBase,
  pnrRaw: string
): Promise<PaymentDispatchResult | null> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) return null;
  try {
    return await runPaymentConfirmationDispatch(pb, {
      pnr,
      source: "auto",
      threshold: "auto",
    });
  } catch (err) {
    console.warn(
      "[payment-dispatch] auto failed",
      pnr,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
