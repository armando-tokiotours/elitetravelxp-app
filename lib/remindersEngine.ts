/**
 * Cross-PNR Communications & Reminders dispatch engine.
 * Scans active ops_hub rows → pending reminder categories. Never auto-sends.
 */

import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  deriveTourPaymentStatus,
  isTourFullyPaid,
} from "@/lib/tourPaymentStatus";
import {
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import {
  REMINDER_IDS,
  computeReminders,
  readCommsSent,
  type CommsSentMap,
  type ReminderId,
  type ReminderItem,
  type ReminderLane,
} from "@/lib/reminderRules";

export { REMINDER_IDS, computeReminders, readCommsSent };
export type { ReminderId, ReminderItem, ReminderLane, CommsSentMap };

/** Category meta for desk filters / icons */
export const REMINDER_CATEGORY_META: Record<
  ReminderId,
  { label: string; shortLabel: string; description: string }
> = {
  balance_reminder: {
    label: "Balance (~90d)",
    shortLabel: "Balance",
    description: "Start ≤90d & >14d away · not fully paid",
  },
  week_prep: {
    label: "1-Week Prep (~7d)",
    shortLabel: "1-Week",
    description: "Start ~7d out · fully paid",
  },
  day_before: {
    label: "Final Details (~2d)",
    shortLabel: "Final",
    description: "Start ~2d out · fully paid",
  },
  post_tour_survey: {
    label: "Post-Tour Survey",
    shortLabel: "Survey",
    description: "~2 days after trip end",
  },
};

export type ReminderBookingInput = {
  id?: string;
  pnr: string;
  status?: string | null;
  tour_date?: string | null;
  end_date?: string | null;
  /** Multi-day length; used when end_date missing (start + duration − 1). */
  duration_days?: number | null;
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  guestName?: string | null;
  guestEmail?: string | null;
  primary_city?: string | null;
  extras?: unknown;
  guest_summary?: string | null;
};

export type PendingReminder = ReminderItem & {
  pnr: string;
  opsHubId: string | null;
  guestName: string;
  guestEmail: string;
  tourDate: string | null;
  endDate: string | null;
  primaryCity: string | null;
  daysUntilStart: number | null;
  daysSinceEnd: number | null;
  paymentStatus: string;
  category: ReminderId;
};

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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole calendar days from `from` → `to` (noon-anchored). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Resolve trip end: end_date → start + duration_days − 1 → start. */
export function resolveTripEndDate(input: {
  tour_date?: string | null;
  end_date?: string | null;
  duration_days?: number | null;
}): string | null {
  const explicit = parseYmd(input.end_date);
  if (explicit) return toYmd(explicit);
  const start = parseYmd(input.tour_date);
  if (!start) return null;
  const days = Math.max(0, Math.round(Number(input.duration_days) || 0));
  if (days > 1) return toYmd(addDays(start, days - 1));
  return toYmd(start);
}

export function resolveFullyPaid(input: ReminderBookingInput): boolean {
  if (isTourFullyPaid(input)) return true;
  const packageTotal = roundEur(Number(input.estimated_total_eur) || 0);
  const paid = roundEur(Number(input.total_paid_eur) || 0);
  if (packageTotal > 0 && paid > 0) {
    return paymentBadgeForAmount(paid, packageTotal).fullyPaid;
  }
  return false;
}

export function paymentStatusLabel(input: ReminderBookingInput): string {
  if (resolveFullyPaid(input)) return "FULLY_PAID";
  return deriveTourPaymentStatus(input);
}

/**
 * Whether a computed reminder is currently in its dispatch window
 * (actionable for the cross-PNR desk).
 */
export function isInDispatchWindow(
  id: ReminderId,
  opts: {
    daysUntilStart: number | null;
    daysSinceEnd: number | null;
    fullyPaid: boolean;
    eligible: boolean;
  }
): boolean {
  if (!opts.eligible) return false;
  const until = opts.daysUntilStart;
  const since = opts.daysSinceEnd;

  switch (id) {
    case "balance_reminder":
      // ≤90 and >14 days out, not fully paid (eligible encodes !fullyPaid)
      return until != null && until > 14 && until <= 90 && !opts.fullyPaid;
    case "week_prep":
      // ~7d: after final-details band, through 7 days out
      return until != null && until > 2 && until <= 7 && opts.fullyPaid;
    case "day_before":
      // Final details ~2d (includes day-of / tomorrow)
      return until != null && until >= 0 && until <= 2 && opts.fullyPaid;
    case "post_tour_survey":
      // From 2 days after end, keep open for two weeks
      return since != null && since >= 2 && since <= 14;
    default:
      return false;
  }
}

/**
 * Scan all active bookings and return pending (not-yet-sent) reminders
 * currently inside their category windows. Manual approval only.
 */
export function calculatePendingReminders(
  bookings: ReminderBookingInput[],
  nowInput?: Date
): PendingReminder[] {
  const now = startOfDay(nowInput || new Date());
  const out: PendingReminder[] = [];

  for (const booking of bookings) {
    const pnr = String(booking.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;

    const canonical = toCanonicalStatus(booking.status);
    if (canonical === "cancelled") continue;

    const tourDate = parseYmd(booking.tour_date);
    const endYmd = resolveTripEndDate(booking);
    const endDate = parseYmd(endYmd);
    const daysUntilStart = tourDate
      ? calendarDaysBetween(now, tourDate)
      : null;
    const daysSinceEnd = endDate ? calendarDaysBetween(endDate, now) : null;
    const fullyPaid = resolveFullyPaid(booking);

    const items = computeReminders({
      tourDate: booking.tour_date,
      endDate: endYmd,
      status: booking.status,
      tour_payment_status: booking.tour_payment_status,
      payment_confirmed: booking.payment_confirmed,
      concierge_fee_paid: booking.concierge_fee_paid,
      deposit_amount: booking.deposit_amount,
      concierge_fee_amount: booking.concierge_fee_amount,
      total_paid_eur: booking.total_paid_eur,
      estimated_total_eur: booking.estimated_total_eur,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      pnr,
      extras: booking.extras,
      now,
    });

    for (const item of items) {
      if (item.lane === "sent") continue;
      if (
        !isInDispatchWindow(item.id, {
          daysUntilStart,
          daysSinceEnd,
          fullyPaid,
          eligible: item.eligible,
        })
      ) {
        continue;
      }

      out.push({
        ...item,
        lane: "due",
        pnr,
        opsHubId: booking.id ? String(booking.id) : null,
        guestName: String(booking.guestName || "").trim(),
        guestEmail: String(booking.guestEmail || "")
          .trim()
          .toLowerCase(),
        tourDate: tourDate ? toYmd(tourDate) : null,
        endDate: endYmd,
        primaryCity: String(booking.primary_city || "").trim() || null,
        daysUntilStart,
        daysSinceEnd,
        paymentStatus: paymentStatusLabel(booking),
        category: item.id,
      });
    }
  }

  // Soonest trip / earliest due first
  out.sort((a, b) => {
    const da = a.dueDate || "9999-99-99";
    const db = b.dueDate || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.pnr.localeCompare(b.pnr);
  });

  return out;
}

/** Count pending rows per category (for filter chips). */
export function countByCategory(
  rows: PendingReminder[]
): Record<ReminderId | "all", number> {
  const counts: Record<ReminderId | "all", number> = {
    all: rows.length,
    balance_reminder: 0,
    week_prep: 0,
    day_before: 0,
    post_tour_survey: 0,
  };
  for (const r of rows) {
    counts[r.category] += 1;
  }
  return counts;
}
