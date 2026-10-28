/**
 * CEO Executive Command Dashboard — aggregate ops_hub + dispatch/ticket signals.
 * No `bookings` collection — uses ops_hub + bookings_and_leads guests + helpers.
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  isProcurementServiceItem,
  isTicketServiceReady,
  parseOpsHubExtras,
} from "@/lib/agentServices";
import {
  computePendingBalance,
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  buildDriverDispatchLegs,
  normalizeDriverLegStatus,
} from "@/lib/driverDispatch";
import {
  normalizeGuideJobStatus,
  normalizeTourDateIso,
  type GuideJobRow,
} from "@/lib/guideJobs";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import {
  classifyPaymentLane,
  detectDriverGap,
  detectGuideGap,
  shouldIncludeHubOnCalendar,
} from "@/lib/opsCalendarStatus";

export type CeoGuestLookup = {
  name?: string;
  email?: string;
  durationDays?: number | null;
};

export type CeoFinancialOverview = {
  totalGrossRevenueEur: number;
  outstandingBalancesEur: number;
  pipelineValueEur: number;
  /** null when cost fields / FX insufficient — UI shows N/A */
  netProfitMarginPct: number | null;
  confirmedBookingCount: number;
  pipelineBookingCount: number;
  costBasisNote: string | null;
};

export type CeoDispatchAlerts = {
  unassignedGuides: number;
  unassignedDrivers: number;
  pendingTicketProcurements: number;
  guideAlertPnrs: string[];
  driverAlertPnrs: string[];
  ticketAlertPnrs: string[];
};

export type CeoIncomingTrip = {
  pnr: string;
  guestName: string;
  tourDate: string;
  paxLabel: string;
  paymentBadgeLabel: string;
  paymentBadgeKind: "none" | "fee" | "progress30" | "fully_paid" | "unpaid";
  primaryCity: string;
  calendarHref: string;
  opsHref: string;
};

export type CeoDashboardMetrics = {
  financial: CeoFinancialOverview;
  dispatch: CeoDispatchAlerts;
  incoming7d: CeoIncomingTrip[];
  generatedAt: string;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ymdToday(now = new Date()): string {
  const d = startOfLocalDay(now);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive window: today .. today+daysInclusive */
export function isYmdWithinDays(
  raw: string | null | undefined,
  daysInclusive: number,
  now = new Date()
): boolean {
  const iso = normalizeTourDateIso(raw);
  if (!iso) return false;
  const today = ymdToday(now);
  const end = addDaysYmd(today, daysInclusive);
  return iso >= today && iso <= end;
}

function hubCostJpy(hub: OpsHubRow): number {
  return (
    Math.max(0, Number(hub.guide_pay_jpy) || 0) +
    Math.max(0, Number(hub.driver_pay_jpy) || 0) +
    Math.max(0, Number(hub.ticket_cost_jpy) || 0)
  );
}

function paymentShortBadge(hub: OpsHubRow): {
  label: string;
  kind: CeoIncomingTrip["paymentBadgeKind"];
} {
  const paid = roundEur(Number(hub.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  if (packageTotal > 0 && paid > 0) {
    const badge = paymentBadgeForAmount(paid, packageTotal);
    if (badge.fullyPaid) return { label: "Fully paid", kind: "fully_paid" };
    if (badge.kind === "progress30")
      return { label: "30% secured", kind: "progress30" };
    if (badge.kind === "fee") return { label: "Fee paid", kind: "fee" };
  }
  const lane = classifyPaymentLane(hub);
  if (lane.tourPaymentStatus === "FULLY_PAID")
    return { label: "Fully paid", kind: "fully_paid" };
  if (lane.tourPaymentStatus === "PARTIALLY_PAID")
    return { label: "Partial", kind: "progress30" };
  if (lane.tourPaymentStatus === "FEE_PAID")
    return { label: "Fee paid", kind: "fee" };
  return { label: "Unpaid", kind: "unpaid" };
}

function paxFromGuestSummary(summary?: string | null): string {
  const s = String(summary || "").trim();
  if (!s) return "—";
  // guest_summary often already includes "2 adults, 1 child"
  const m = s.match(
    /(\d+)\s*adult|\d+\s*pax|\d+\s*guest|\d+\s*traveler/i
  );
  if (m) return s.length > 48 ? `${s.slice(0, 45)}…` : s;
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

/**
 * Pending ticket procurements for a hub:
 * - ticket_status needed/ordered, OR
 * - procurement cart lines without voucher / not ready
 */
export function countPendingTicketProcurements(hub: OpsHubRow): number {
  const st = String(hub.ticket_status || "")
    .trim()
    .toLowerCase();
  if (st === "needed" || st === "ordered") {
    const extras = parseOpsHubExtras(hub.extras);
    const lines = (extras.agent_services || []).filter(isProcurementServiceItem);
    if (lines.length === 0) return 1;
    return lines.filter(
      (item) =>
        !isTicketServiceReady(item, {
          opsTicketStatus: hub.ticket_status,
          hasVoucher: Boolean(
            String(item.voucherUrl || item.voucherBlobPathname || "").trim()
          ),
        })
    ).length || 1;
  }

  if (hub.tickets_needed === true && (!st || st === "none" || st === "pending")) {
    return 1;
  }

  const extras = parseOpsHubExtras(hub.extras);
  const pending = (extras.agent_services || [])
    .filter(isProcurementServiceItem)
    .filter(
      (item) =>
        !isTicketServiceReady(item, {
          opsTicketStatus: hub.ticket_status,
          hasVoucher: Boolean(
            String(item.voucherUrl || item.voucherBlobPathname || "").trim()
          ),
        })
    );
  return pending.length;
}

export function computeFinancialOverview(
  hubs: OpsHubRow[],
  opts?: { eurJpy?: number | null }
): CeoFinancialOverview {
  let totalGrossRevenueEur = 0;
  let outstandingBalancesEur = 0;
  let pipelineValueEur = 0;
  let confirmedBookingCount = 0;
  let pipelineBookingCount = 0;
  let costJpyOnConfirmed = 0;
  let costRows = 0;

  for (const hub of hubs) {
    if (!shouldIncludeHubOnCalendar(hub)) continue;
    const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
    const paid = roundEur(Number(hub.total_paid_eur) || 0);
    const lane = classifyPaymentLane(hub);

    outstandingBalancesEur += computePendingBalance(packageTotal, paid);

    if (lane.paymentLane === "confirmed") {
      confirmedBookingCount += 1;
      totalGrossRevenueEur += packageTotal > 0 ? packageTotal : paid;
      const c = hubCostJpy(hub);
      if (c > 0) {
        costJpyOnConfirmed += c;
        costRows += 1;
      }
    } else {
      // Quoted drafts + fee-only design = pipeline
      pipelineBookingCount += 1;
      pipelineValueEur += packageTotal > 0 ? packageTotal : paid;
    }
  }

  let netProfitMarginPct: number | null = null;
  let costBasisNote: string | null = null;
  const eurJpy = opts?.eurJpy != null && opts.eurJpy > 0 ? opts.eurJpy : null;

  if (
    totalGrossRevenueEur > 0 &&
    costJpyOnConfirmed > 0 &&
    eurJpy != null
  ) {
    const costsEur = costJpyOnConfirmed / eurJpy;
    netProfitMarginPct =
      Math.round(((totalGrossRevenueEur - costsEur) / totalGrossRevenueEur) * 1000) /
      10;
    costBasisNote = `Approx. from ops_hub guide/driver/ticket JPY costs on ${costRows} confirmed PNR(s) ÷ EUR/JPY ${eurJpy.toFixed(2)}`;
  } else if (totalGrossRevenueEur > 0 && costJpyOnConfirmed <= 0) {
    costBasisNote =
      "Net margin N/A — no guide/driver/ticket cost JPY on confirmed hubs yet";
  } else if (totalGrossRevenueEur > 0 && !eurJpy) {
    costBasisNote = "Net margin N/A — EUR/JPY rate unavailable for cost conversion";
  }

  return {
    totalGrossRevenueEur: roundEur(totalGrossRevenueEur),
    outstandingBalancesEur: roundEur(outstandingBalancesEur),
    pipelineValueEur: roundEur(pipelineValueEur),
    netProfitMarginPct,
    confirmedBookingCount,
    pipelineBookingCount,
    costBasisNote,
  };
}

export function computeDispatchAlerts(
  hubs: OpsHubRow[],
  opts: {
    dispatchByPnr?: Record<string, OpsDispatchRow>;
    guideJobs?: GuideJobRow[];
    now?: Date;
    windowDays?: number;
  } = {}
): CeoDispatchAlerts {
  const now = opts.now || new Date();
  const windowDays = opts.windowDays ?? 14;
  const dispatchByPnr = opts.dispatchByPnr || {};
  const guideAlert = new Set<string>();
  const driverAlert = new Set<string>();
  const ticketAlert = new Set<string>();
  let pendingTicketProcurements = 0;

  // Guide jobs with open status in window
  for (const job of opts.guideJobs || []) {
    const status = normalizeGuideJobStatus(job.status);
    if (
      status !== "UNASSIGNED" &&
      status !== "OPEN_BOARD" &&
      status !== "REJECTED"
    ) {
      continue;
    }
    if (!isYmdWithinDays(job.tour_date, windowDays, now)) continue;
    const pnr = String(job.pnr || "")
      .trim()
      .toUpperCase();
    if (pnr) guideAlert.add(pnr);
  }

  for (const hub of hubs) {
    if (!shouldIncludeHubOnCalendar(hub)) continue;
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    const dispatch = dispatchByPnr[pnr] || null;
    const inWindow =
      isYmdWithinDays(hub.tour_date, windowDays, now) ||
      // Also catch multi-day trips whose start is soon even if end is later
      (() => {
        const start = normalizeTourDateIso(hub.tour_date);
        if (!start) return false;
        return isYmdWithinDays(start, windowDays, now);
      })();

    if (inWindow) {
      const { guideGap } = detectGuideGap(hub, dispatch);
      if (guideGap) guideAlert.add(pnr);

      // Driver: prefer unassigned legs dated in window; else PNR-level gap
      const legs = buildDriverDispatchLegs({ hub, dispatch });
      const unassignedInWindow = legs.filter((leg) => {
        if (normalizeDriverLegStatus(leg.status) !== "UNASSIGNED") return false;
        if (!leg.serviceDate) return inWindow;
        return isYmdWithinDays(leg.serviceDate, windowDays, now);
      });
      if (unassignedInWindow.length > 0 || detectDriverGap(hub, dispatch)) {
        if (unassignedInWindow.length > 0 || inWindow) {
          driverAlert.add(pnr);
        }
      }
    }

    const pendingTickets = countPendingTicketProcurements(hub);
    if (pendingTickets > 0 && inWindow) {
      ticketAlert.add(pnr);
      pendingTicketProcurements += pendingTickets;
    } else if (pendingTickets > 0 && !hub.tour_date) {
      // Undated but flagged — still surface
      ticketAlert.add(pnr);
      pendingTicketProcurements += pendingTickets;
    }
  }

  return {
    unassignedGuides: guideAlert.size,
    unassignedDrivers: driverAlert.size,
    pendingTicketProcurements,
    guideAlertPnrs: [...guideAlert].sort(),
    driverAlertPnrs: [...driverAlert].sort(),
    ticketAlertPnrs: [...ticketAlert].sort(),
  };
}

export function computeIncoming7DayTrips(
  hubs: OpsHubRow[],
  opts?: {
    guestsByPnr?: Record<string, CeoGuestLookup>;
    now?: Date;
  }
): CeoIncomingTrip[] {
  const now = opts?.now || new Date();
  const guests = opts?.guestsByPnr || {};
  const out: CeoIncomingTrip[] = [];

  for (const hub of hubs) {
    if (!shouldIncludeHubOnCalendar(hub)) continue;
    if (toCanonicalStatus(hub.status) === "cancelled") continue;
    const tourDate = normalizeTourDateIso(hub.tour_date);
    if (!tourDate || !isYmdWithinDays(tourDate, 7, now)) continue;

    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    const guest = guests[pnr];
    const guestName =
      String(guest?.name || "").trim() ||
      String(hub.guest_summary || "").trim().split(/[·|]/)[0]?.trim() ||
      "Guest";
    const badge = paymentShortBadge(hub);

    out.push({
      pnr,
      guestName,
      tourDate,
      paxLabel: paxFromGuestSummary(hub.guest_summary),
      paymentBadgeLabel: badge.label,
      paymentBadgeKind: badge.kind,
      primaryCity: String(hub.primary_city || "").trim() || "Japan",
      calendarHref: `/ops/calendar`,
      opsHref: `/ops?pnr=${encodeURIComponent(pnr)}`,
    });
  }

  out.sort((a, b) => a.tourDate.localeCompare(b.tourDate) || a.pnr.localeCompare(b.pnr));
  return out;
}

export function buildCeoDashboardMetrics(input: {
  hubs: OpsHubRow[];
  dispatchByPnr?: Record<string, OpsDispatchRow>;
  guideJobs?: GuideJobRow[];
  guestsByPnr?: Record<string, CeoGuestLookup>;
  eurJpy?: number | null;
  now?: Date;
}): CeoDashboardMetrics {
  return {
    financial: computeFinancialOverview(input.hubs, { eurJpy: input.eurJpy }),
    dispatch: computeDispatchAlerts(input.hubs, {
      dispatchByPnr: input.dispatchByPnr,
      guideJobs: input.guideJobs,
      now: input.now,
      windowDays: 14,
    }),
    incoming7d: computeIncoming7DayTrips(input.hubs, {
      guestsByPnr: input.guestsByPnr,
      now: input.now,
    }),
    generatedAt: (input.now || new Date()).toISOString(),
  };
}
