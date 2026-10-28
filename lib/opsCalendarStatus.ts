/**
 * Operations Calendar — payment lane + action-required (dispatch gap) classification.
 * Source of truth: ops_hub payment fields + ops_dispatch / driver_dispatch / guide_jobs.
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  buildDriverDispatchLegs,
  normalizeDriverLegStatus,
} from "@/lib/driverDispatch";
import {
  normalizeGuideConfirmStatus,
  type GuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import {
  deriveTourPaymentStatus,
  type TourPaymentStatus,
} from "@/lib/tourPaymentStatus";
import { resolveTripEndDate } from "@/lib/remindersEngine";

/** Filter / chip lanes shown in the calendar sidebar. */
export type OpsCalendarPaymentLane = "confirmed" | "design" | "draft";

/** Visual color key for an event chip. */
export type OpsCalendarColorKey =
  | "confirmed"
  | "design"
  | "draft"
  | "critical";

export type OpsCalendarStatusMeta = {
  paymentLane: OpsCalendarPaymentLane;
  tourPaymentStatus: TourPaymentStatus;
  /** Green locked / 30%+ / fully paid */
  datesLocked: boolean;
  /** Red — unassigned guide/driver on an upcoming dated tour */
  actionRequired: boolean;
  /** Color used on the grid (critical overrides payment tint). */
  colorKey: OpsCalendarColorKey;
  guideStatus: GuideConfirmStatus;
  guideGap: boolean;
  driverGap: boolean;
  label: string;
  shortLabel: string;
};

export const OPS_CALENDAR_COLOR: Record<
  OpsCalendarColorKey,
  { dot: string; chip: string; bar: string; label: string }
> = {
  confirmed: {
    dot: "bg-emerald-400",
    chip: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    bar: "bg-emerald-500",
    label: "Confirmed / Fully Paid",
  },
  design: {
    dot: "bg-amber-400",
    chip: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    bar: "bg-amber-500",
    label: "Paid Fee / Design Mode",
  },
  draft: {
    dot: "bg-sky-400",
    chip: "border-sky-500/40 bg-sky-500/15 text-sky-200",
    bar: "bg-sky-500",
    label: "Hypothetical / Unpaid Drafts",
  },
  critical: {
    dot: "bg-red-500",
    chip: "border-red-500/45 bg-red-500/15 text-red-200",
    bar: "bg-red-500",
    label: "Action Required",
  },
};

function parseYmdNoon(raw?: string | null): Date | null {
  const iso = normalizeTourDateIso(raw);
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

/** Inclusive trip still upcoming or in progress (not fully past). */
export function isUpcomingOrActiveTrip(
  input: {
    tour_date?: string | null;
    end_date?: string | null;
    duration_days?: number | null;
  },
  nowInput?: Date
): boolean {
  const now = startOfLocalDay(nowInput || new Date());
  const start = parseYmdNoon(input.tour_date);
  if (!start) return false;
  const endIso = resolveTripEndDate(input);
  const end = parseYmdNoon(endIso) || start;
  return end.getTime() >= now.getTime();
}

/**
 * Payment lane for calendar color-coding (ignores dispatch gaps).
 * 🟢 confirmed = FULLY_PAID or 30%+ / PARTIALLY_PAID (dates locked)
 * 🟡 design = FEE_PAID / fee-only credit (dates moveable)
 * 🔵 draft = UNPAID / quoted with no fee
 */
export function classifyPaymentLane(input: {
  tour_payment_status?: string | null;
  payment_confirmed?: boolean | null;
  concierge_fee_paid?: boolean | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
}): {
  paymentLane: OpsCalendarPaymentLane;
  tourPaymentStatus: TourPaymentStatus;
  datesLocked: boolean;
} {
  const tourPaymentStatus = deriveTourPaymentStatus(input);
  const paid = roundEur(Number(input.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(input.estimated_total_eur) || 0);
  const badge =
    packageTotal > 0 && paid > 0
      ? paymentBadgeForAmount(paid, packageTotal)
      : null;

  if (
    tourPaymentStatus === "FULLY_PAID" ||
    badge?.fullyPaid ||
    tourPaymentStatus === "PARTIALLY_PAID" ||
    badge?.kind === "progress30"
  ) {
    return {
      paymentLane: "confirmed",
      tourPaymentStatus,
      datesLocked: true,
    };
  }

  if (
    tourPaymentStatus === "FEE_PAID" ||
    badge?.kind === "fee" ||
    Boolean(input.concierge_fee_paid)
  ) {
    return {
      paymentLane: "design",
      tourPaymentStatus:
        tourPaymentStatus === "UNPAID" ? "FEE_PAID" : tourPaymentStatus,
      datesLocked: false,
    };
  }

  return {
    paymentLane: "draft",
    tourPaymentStatus,
    datesLocked: false,
  };
}

export function detectGuideGap(
  hub: OpsHubRow,
  dispatch?: OpsDispatchRow | null
): { guideStatus: GuideConfirmStatus; guideGap: boolean } {
  const guideNeeded =
    hub.guide_needed !== false ||
    Boolean(dispatch?.guide_needed) ||
    Boolean(String(hub.assigned_guide_id || dispatch?.assigned_guide_id || "").trim());

  const guideStatus = normalizeGuideConfirmStatus(
    dispatch?.guide_mode || (hub.assigned_guide_id ? "direct" : "unassigned"),
    {
      boardVisible: Boolean(dispatch?.guide_board_visible),
      assignedGuideId:
        dispatch?.assigned_guide_id || hub.assigned_guide_id || "",
      guideResponse: dispatch?.guide_response,
    }
  );

  // Pending / open board still needs Ops attention before day-of.
  const guideGap =
    guideNeeded &&
    (guideStatus === "unassigned" ||
      guideStatus === "refused" ||
      guideStatus === "posted_open_board");

  return { guideStatus, guideGap };
}

export function detectDriverGap(
  hub: OpsHubRow,
  dispatch?: OpsDispatchRow | null
): boolean {
  const legs = buildDriverDispatchLegs({ hub, dispatch });
  const unassignedLegs = legs.filter(
    (l) => normalizeDriverLegStatus(l.status) === "UNASSIGNED"
  );
  if (unassignedLegs.length > 0) return true;

  const driverNeeded =
    hub.driver_needed === true ||
    dispatch?.driver_needed === true ||
    legs.length > 0;

  if (!driverNeeded) return false;

  const mode = String(dispatch?.driver_mode || "unassigned")
    .trim()
    .toLowerCase();
  const hasDriver = Boolean(
    String(dispatch?.assigned_driver_id || hub.assigned_driver_id || "").trim()
  );
  if (hasDriver && (mode === "direct" || mode === "claimed")) return false;
  if (mode === "open") return true; // posted but unclaimed
  return !hasDriver;
}

/**
 * Full calendar status for one ops_hub row (+ optional dispatch pocket).
 */
export function classifyOpsCalendarStatus(
  hub: OpsHubRow,
  opts?: {
    dispatch?: OpsDispatchRow | null;
    durationDays?: number | null;
    now?: Date;
    /** When guide_jobs reports any UNASSIGNED/OPEN_BOARD for this PNR */
    hasOpenGuideJobs?: boolean;
  }
): OpsCalendarStatusMeta {
  const payment = classifyPaymentLane(hub);
  const { guideStatus, guideGap } = detectGuideGap(hub, opts?.dispatch);
  const driverGap = detectDriverGap(hub, opts?.dispatch);
  const upcoming = isUpcomingOrActiveTrip(
    {
      tour_date: hub.tour_date,
      end_date: hub.end_date,
      duration_days: opts?.durationDays,
    },
    opts?.now
  );

  const actionRequired =
    upcoming &&
    (guideGap || driverGap || Boolean(opts?.hasOpenGuideJobs));

  const colorKey: OpsCalendarColorKey = actionRequired
    ? "critical"
    : payment.paymentLane;

  const labels: Record<OpsCalendarColorKey, { label: string; short: string }> =
    {
      confirmed: {
        label: "Confirmed / Fully Paid",
        short: "Confirmed",
      },
      design: {
        label: "Paid Fee / Design Mode",
        short: "Design",
      },
      draft: {
        label: "Hypothetical / Unpaid Draft",
        short: "Draft",
      },
      critical: {
        label: "Action Required",
        short: "Action",
      },
    };

  return {
    paymentLane: payment.paymentLane,
    tourPaymentStatus: payment.tourPaymentStatus,
    datesLocked: payment.datesLocked,
    actionRequired,
    colorKey,
    guideStatus,
    guideGap,
    driverGap,
    label: labels[colorKey].label,
    shortLabel: labels[colorKey].short,
  };
}

export function shouldIncludeHubOnCalendar(hub: OpsHubRow): boolean {
  return toCanonicalStatus(hub.status) !== "cancelled";
}
