/**
 * Situational reminder rules for Ops COMMS & REMINDERS.
 * Computes Due / Pending / Sent — never auto-sends.
 */

import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import {
  deriveTourPaymentStatus,
  isTourFullyPaid,
} from "@/lib/tourPaymentStatus";
import { parseOpsHubExtras } from "@/lib/agentServices";

export const REMINDER_IDS = [
  "balance_reminder",
  "week_prep",
  "day_before",
  "post_tour_survey",
] as const;

export type ReminderId = (typeof REMINDER_IDS)[number];

export type ReminderLane = "due" | "pending" | "sent";

export type ReminderItem = {
  id: ReminderId;
  title: string;
  lane: ReminderLane;
  /** Calendar due date YYYY-MM-DD */
  dueDate: string | null;
  subject: string;
  previewText: string;
  previewHtml: string;
  reason: string;
  /** ISO timestamp when marked sent (from ops_hub.extras.comms_sent) */
  sentAt: string | null;
  eligible: boolean;
};

export type CommsSentMap = Partial<Record<ReminderId, string>>;

function parseYmd(raw?: string | null): Date | null {
  const s = String(raw || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

/** Deposit-ish paid but not fully settled (fee / 30% / partial). */
export function isDepositIshPaid(input: {
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
}): boolean {
  if (isTourFullyPaid(input)) return false;
  const status = deriveTourPaymentStatus(input);
  if (
    status === "FEE_PAID" ||
    status === "PARTIALLY_PAID"
  ) {
    return true;
  }
  const paid = roundEur(Number(input.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(input.estimated_total_eur) || 0);
  if (paid <= 0) return Boolean(input.concierge_fee_paid);
  if (packageTotal > 0) {
    const badge = paymentBadgeForAmount(paid, packageTotal);
    return badge.kind === "fee" || badge.kind === "progress30";
  }
  return paid > 0;
}

export function readCommsSent(extras: unknown): CommsSentMap {
  let obj: Record<string, unknown> = {};
  if (typeof extras === "string") {
    try {
      obj = JSON.parse(extras) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (extras && typeof extras === "object") {
    obj = extras as Record<string, unknown>;
  }
  const raw = obj.comms_sent;
  if (!raw || typeof raw !== "object") return {};
  const out: CommsSentMap = {};
  for (const id of REMINDER_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (v != null && String(v).trim()) out[id] = String(v).trim();
  }
  return out;
}

/** Merge sent flag into ops_hub.extras without dropping agent_services etc. */
export function mergeCommsSentFlag(
  existingExtras: unknown,
  reminderId: ReminderId,
  sentAtIso: string
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
  // Ensure parsed agent cart shape is preserved when present
  const parsed = parseOpsHubExtras(existingExtras);
  const prevSent =
    base.comms_sent && typeof base.comms_sent === "object"
      ? { ...(base.comms_sent as Record<string, string>) }
      : {};
  return {
    ...base,
    agent_services: parsed.agent_services || base.agent_services || [],
    final_approved_price:
      parsed.final_approved_price ?? base.final_approved_price ?? null,
    price_mode: parsed.price_mode ?? base.price_mode,
    pending_discount_request:
      parsed.pending_discount_request ?? base.pending_discount_request ?? null,
    comms_sent: {
      ...prevSent,
      [reminderId]: sentAtIso,
    },
  };
}

function guestGreeting(name?: string | null): string {
  const n = String(name || "").trim();
  return n ? `Hi ${n.split(/\s+/)[0]},` : "Hi,";
}

function buildTemplates(opts: {
  id: ReminderId;
  guestName?: string | null;
  pnr?: string | null;
  tourDate?: string | null;
}): { subject: string; previewText: string; previewHtml: string } {
  const greet = guestGreeting(opts.guestName);
  const pnr = String(opts.pnr || "").trim() || "your booking";
  const tour = String(opts.tourDate || "").slice(0, 10) || "your tour date";

  switch (opts.id) {
    case "balance_reminder":
      return {
        subject: `Balance reminder · ${pnr}`,
        previewText: `${greet}\n\nYour Japan journey (${pnr}) is approaching (${tour}). A tour balance is still outstanding — reply or pay via your itinerary link when ready.\n\n— TokioTours Concierge`,
        previewHtml: `<p>${greet}</p><p>Your Japan journey (<strong>${pnr}</strong>) is approaching (<strong>${tour}</strong>). A tour balance is still outstanding — reply or pay via your itinerary link when ready.</p><p>— TokioTours Concierge</p>`,
      };
    case "week_prep":
      return {
        subject: `One week to go · ${pnr}`,
        previewText: `${greet}\n\nYour tour (${pnr}) starts on ${tour} — about one week away. We’ll share final meeting details soon. Pack comfortable shoes and keep this email handy.\n\n— TokioTours Concierge`,
        previewHtml: `<p>${greet}</p><p>Your tour (<strong>${pnr}</strong>) starts on <strong>${tour}</strong> — about one week away. We’ll share final meeting details soon. Pack comfortable shoes and keep this email handy.</p><p>— TokioTours Concierge</p>`,
      };
    case "day_before":
      return {
        subject: `Final details · tomorrow · ${pnr}`,
        previewText: `${greet}\n\nFinal check-in for ${pnr} tomorrow (${tour}). Confirm pickup time on your itinerary and save your guide contact once unlocked.\n\n— TokioTours Concierge`,
        previewHtml: `<p>${greet}</p><p>Final check-in for <strong>${pnr}</strong> tomorrow (<strong>${tour}</strong>). Confirm pickup time on your itinerary and save your guide contact once unlocked.</p><p>— TokioTours Concierge</p>`,
      };
    case "post_tour_survey":
      return {
        subject: `How was your journey? · ${pnr}`,
        previewText: `${greet}\n\nThank you for travelling with TokioTours (${pnr}). We’d love a short note on what went well — reply to this email anytime.\n\n— TokioTours Concierge`,
        previewHtml: `<p>${greet}</p><p>Thank you for travelling with TokioTours (<strong>${pnr}</strong>). We’d love a short note on what went well — reply to this email anytime.</p><p>— TokioTours Concierge</p>`,
      };
  }
}

export type ComputeRemindersInput = {
  tourDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  guestName?: string | null;
  guestEmail?: string | null;
  pnr?: string | null;
  extras?: unknown;
  comms_sent?: CommsSentMap | null;
  now?: Date;
};

/**
 * Build reminder cards for Ops. Cancelled bookings → empty list.
 * No auto-send — Ops approves manually.
 */
export function computeReminders(input: ComputeRemindersInput): ReminderItem[] {
  const canonical = toCanonicalStatus(input.status);
  if (canonical === "cancelled") return [];

  const now = startOfDay(input.now || new Date());
  const tour = parseYmd(input.tourDate);
  const end = parseYmd(input.endDate) || tour;
  const sentMap = {
    ...readCommsSent(input.extras),
    ...(input.comms_sent || {}),
  };

  const fullyPaid = isTourFullyPaid(input) ||
    (roundEur(Number(input.estimated_total_eur) || 0) > 0 &&
      paymentBadgeForAmount(
        roundEur(Number(input.total_paid_eur) || 0),
        roundEur(Number(input.estimated_total_eur) || 0)
      ).fullyPaid);

  const depositIsh = isDepositIshPaid(input);

  type Spec = {
    id: ReminderId;
    title: string;
    due: Date | null;
    eligible: boolean;
    reason: string;
  };

  const specs: Spec[] = [
    {
      id: "balance_reminder",
      title: "Balance reminder (~90 days out)",
      due: tour ? addDays(tour, -90) : null,
      eligible: Boolean(tour && depositIsh && !fullyPaid),
      reason: !tour
        ? "Tour date missing"
        : fullyPaid
          ? "Already fully paid"
          : !depositIsh
            ? "No deposit / fee paid yet"
            : "Deposit paid — balance still open",
    },
    {
      id: "week_prep",
      title: "1-week prep",
      due: tour ? addDays(tour, -7) : null,
      eligible: Boolean(tour && fullyPaid),
      reason: !tour
        ? "Tour date missing"
        : !fullyPaid
          ? "Requires full payment"
          : "Fully paid — prep window",
    },
    {
      id: "day_before",
      title: "1-day final details",
      due: tour ? addDays(tour, -1) : null,
      eligible: Boolean(tour && fullyPaid),
      reason: !tour
        ? "Tour date missing"
        : !fullyPaid
          ? "Requires full payment"
          : "Fully paid — final details",
    },
    {
      id: "post_tour_survey",
      title: "Post-tour survey (~2 days after)",
      due: end ? addDays(end, 2) : null,
      eligible: Boolean(end),
      reason: !end
        ? "End / tour date missing"
        : "After trip wrap-up",
    },
  ];

  return specs.map((spec) => {
    const sentAt = sentMap[spec.id] || null;
    const tpl = buildTemplates({
      id: spec.id,
      guestName: input.guestName,
      pnr: input.pnr,
      tourDate: input.tourDate,
    });
    let lane: ReminderLane = "pending";
    if (sentAt) {
      lane = "sent";
    } else if (
      spec.eligible &&
      spec.due &&
      startOfDay(spec.due).getTime() <= now.getTime()
    ) {
      lane = "due";
    } else {
      lane = "pending";
    }
    return {
      id: spec.id,
      title: spec.title,
      lane,
      dueDate: spec.due ? toYmd(spec.due) : null,
      subject: tpl.subject,
      previewText: tpl.previewText,
      previewHtml: tpl.previewHtml,
      reason: spec.reason,
      sentAt,
      eligible: spec.eligible,
    };
  });
}

export function reminderById(
  items: ReminderItem[],
  id: ReminderId
): ReminderItem | undefined {
  return items.find((r) => r.id === id);
}
