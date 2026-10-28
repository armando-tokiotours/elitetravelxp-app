/**
 * Super User Tickets Master Desk — procurement queue classification.
 * Sources: ops_hub + agent_services procurement lines (no `bookings` collection).
 *
 * Payment lock: tickets needed but payment lane is NOT at least 30% deposit /
 * PARTIALLY_PAID / progress30 / FULLY_PAID (via classifyPaymentLane + total_paid).
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  isTicketServiceReady,
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import { classifyPaymentLane } from "@/lib/opsCalendarStatus";
import {
  deriveTourPaymentStatus,
  type TourPaymentStatus,
} from "@/lib/tourPaymentStatus";
import {
  extractProcurementItems,
  type NormalizedProcurementItem,
  type ProcurementKind,
  type ProcurementTicketCategory,
} from "@/lib/ticketNormalizer";

export type TicketsMasterFilter =
  | "ready_to_buy"
  | "payment_locked"
  | "awaiting_pdf"
  | "completed"
  | "all";

/** Primary queue bucket for a PNR that needs (or needed) ticket procurement. */
export type TicketsMasterBucket =
  | "ready_to_buy"
  | "payment_locked"
  | "awaiting_pdf"
  | "completed";

export type TicketsMasterGuestLookup = {
  name?: string;
  email?: string;
  paxSummary?: string;
};

export type TicketsMasterItem = {
  id: string;
  title: string;
  category?: string;
  kind: ProcurementKind;
  /** Fine-grained badge: IC_CARD | RAIL_PASS | ATTRACTION | HOTEL | GENERAL_TICKET */
  procurementCategory: ProcurementTicketCategory;
  categoryLabel: string;
  source: NormalizedProcurementItem["source"];
  uploadable: boolean;
  quantity: number;
  isBonus: boolean;
  serviceDate: string | null;
  scheduledDate: string | null;
  hasVoucher: boolean;
  voucherUrl: string | null;
  voucherFilename: string | null;
  fulfillmentStatus: string | null;
  notes: string | null;
  ready: boolean;
};

export type TicketsMasterCard = {
  hubId: string;
  pnr: string;
  guestName: string;
  guestEmail: string;
  paxLabel: string;
  primaryCity: string;
  tourDate: string | null;
  /** Earliest item service date or tour_date — used for chronological queue. */
  earliestTargetDate: string | null;
  tourPaymentStatus: TourPaymentStatus;
  paymentUnlocked: boolean;
  paymentLabel: string;
  ticketStatus: string;
  bucket: TicketsMasterBucket;
  items: TicketsMasterItem[];
  pendingItemCount: number;
  readyItemCount: number;
  bonusItemCount: number;
  totalItemCount: number;
};

export type TicketsMasterKpis = {
  pendingPurchases: number;
  awaitingPdf: number;
  upcomingTargetDates: number;
  paymentLocks: number;
};

export type TicketsMasterSnapshot = {
  kpis: TicketsMasterKpis;
  cards: TicketsMasterCard[];
  generatedAt: string;
};

function itemHasVoucher(item: ServiceLineItem): boolean {
  return Boolean(
    String(item.voucherUrl || item.voucherBlobPathname || "").trim()
  );
}

function itemTargetDate(
  item: ServiceLineItem,
  tourDate: string | null
): string | null {
  return (
    normalizeTourDateIso(item.serviceDate) ||
    normalizeTourDateIso(item.scheduledDate) ||
    tourDate
  );
}

/**
 * True when guest has hit at least 30% progress / PARTIALLY_PAID / FULLY_PAID.
 * Uses classifyPaymentLane (tour_payment_status + total_paid_eur + badge) —
 * NOT deposit_paid booleans.
 */
export function isPaymentUnlockedForTickets(hub: OpsHubRow): boolean {
  const lane = classifyPaymentLane(hub);
  if (lane.paymentLane === "confirmed" || lane.datesLocked) return true;

  const paid = roundEur(Number(hub.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  if (packageTotal > 0 && paid > 0) {
    const badge = paymentBadgeForAmount(paid, packageTotal);
    if (badge.fullyPaid || badge.kind === "progress30") return true;
  }

  const status = deriveTourPaymentStatus(hub);
  return status === "PARTIALLY_PAID" || status === "FULLY_PAID";
}

export function paymentShortLabel(hub: OpsHubRow): string {
  const paid = roundEur(Number(hub.total_paid_eur) || 0);
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  if (packageTotal > 0 && paid > 0) {
    const badge = paymentBadgeForAmount(paid, packageTotal);
    if (badge.fullyPaid) return "Fully paid";
    if (badge.kind === "progress30") return "30% secured";
    if (badge.kind === "fee") return "Fee paid";
  }
  const status = deriveTourPaymentStatus(hub);
  switch (status) {
    case "FULLY_PAID":
      return "Fully paid";
    case "PARTIALLY_PAID":
      return "Partial / 30%";
    case "FEE_PAID":
      return "Fee paid";
    default:
      return "Unpaid";
  }
}

/** Shared procurement extractor (cart + rollup / day tickets on extras). */
function procurementNormalized(hub: OpsHubRow): NormalizedProcurementItem[] {
  const extras = parseOpsHubExtras(hub.extras);
  return extractProcurementItems({
    agentServices: extras.agent_services,
    extras: hub.extras,
  });
}

/** Cart-backed lines only — used for payment-lock / ready math. */
function procurementLines(hub: OpsHubRow): ServiceLineItem[] {
  return procurementNormalized(hub)
    .map((row) => row.cartItem)
    .filter((item): item is ServiceLineItem => Boolean(item));
}

function mapNormalizedItem(
  row: NormalizedProcurementItem,
  hub: OpsHubRow
): TicketsMasterItem {
  const cart = row.cartItem;
  const hasVoucher = Boolean(
    row.voucherUrl ||
      row.voucherBlobPathname ||
      (cart ? itemHasVoucher(cart) : false)
  );
  const ready = cart
    ? isTicketServiceReady(cart, {
        opsTicketStatus: hub.ticket_status,
        hasVoucher,
      })
    : false;
  return {
    id: row.id,
    title: row.title,
    category: cart?.category || row.category,
    kind: row.kind,
    procurementCategory: row.category,
    categoryLabel: row.categoryLabel,
    source: row.source,
    uploadable: row.uploadable,
    quantity: row.quantity,
    isBonus: row.isBonus,
    serviceDate: normalizeTourDateIso(row.serviceDate) || null,
    scheduledDate: normalizeTourDateIso(row.scheduledDate) || null,
    hasVoucher,
    voucherUrl: row.voucherUrl,
    voucherFilename: row.voucherFilename,
    fulfillmentStatus: row.fulfillmentStatus,
    notes: row.notes,
    ready,
  };
}

/** Hub participates in the ticket procurement universe. */
export function hubInTicketUniverse(hub: OpsHubRow): boolean {
  if (toCanonicalStatus(hub.status) === "cancelled") return false;
  const st = String(hub.ticket_status || "")
    .trim()
    .toLowerCase();
  if (st === "needed" || st === "ordered" || st === "done") return true;
  if (hub.tickets_needed === true) return true;
  return procurementNormalized(hub).length > 0;
}

function earliestDateAmong(
  items: TicketsMasterItem[],
  tourDate: string | null
): string | null {
  let earliest: string | null = null;
  for (const item of items) {
    const d = item.serviceDate || item.scheduledDate || null;
    if (!d) continue;
    if (!earliest || d < earliest) earliest = d;
  }
  if (earliest) return earliest;
  return tourDate;
}

/**
 * Classify a hub into a single primary filter bucket.
 * Priority when work remains: payment_locked → awaiting_pdf → ready_to_buy.
 * When fully vouchered / ticket_status done → completed.
 */
export function classifyTicketsMasterBucket(
  hub: OpsHubRow
): TicketsMasterBucket | null {
  if (!hubInTicketUniverse(hub)) return null;

  const lines = procurementLines(hub);
  const pending = lines.filter(
    (item) =>
      !isTicketServiceReady(item, {
        opsTicketStatus: hub.ticket_status,
        hasVoucher: itemHasVoucher(item),
      })
  );
  const st = String(hub.ticket_status || "")
    .trim()
    .toLowerCase();
  const paymentUnlocked = isPaymentUnlockedForTickets(hub);
  const allLinesReady = lines.length > 0 && pending.length === 0;

  // Done: all procurement vouchers uploaded, or ticket_status done with nothing open
  if (allLinesReady) return "completed";
  if (st === "done" && pending.length === 0) return "completed";

  const needsWork =
    pending.length > 0 ||
    st === "needed" ||
    st === "ordered" ||
    (hub.tickets_needed === true && st !== "done");

  if (!needsWork) return "completed";

  // 🔒 PAYMENT LOCKED — do not buy yet
  if (!paymentUnlocked) return "payment_locked";

  // Purchased/ordered but voucher PDF still missing
  if (st === "ordered" && pending.length > 0) return "awaiting_pdf";
  if (
    pending.length > 0 &&
    pending.some((i) =>
      String(i.fulfillmentStatus || "")
        .toUpperCase()
        .includes("ORDER")
    )
  ) {
    return "awaiting_pdf";
  }

  // Payment verified + procurement still open
  return "ready_to_buy";
}

function paxLabelFrom(
  hub: OpsHubRow,
  guest?: TicketsMasterGuestLookup
): string {
  const fromGuest = String(guest?.paxSummary || "").trim();
  if (fromGuest) return fromGuest;
  const summary = String(hub.guest_summary || "").trim();
  if (!summary) return "—";
  return summary.length > 48 ? `${summary.slice(0, 45)}…` : summary;
}

export function buildTicketsMasterCard(
  hub: OpsHubRow,
  guest?: TicketsMasterGuestLookup
): TicketsMasterCard | null {
  const bucket = classifyTicketsMasterBucket(hub);
  if (!bucket) return null;

  const tourDate = normalizeTourDateIso(hub.tour_date) || null;
  const items = procurementNormalized(hub).map((row) =>
    mapNormalizedItem(row, hub)
  );
  const pendingItemCount = items.filter((i) => !i.ready).length;
  const readyItemCount = items.filter((i) => i.ready).length;
  const bonusItemCount = items.filter((i) => i.isBonus).length;
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase();

  const guestName =
    String(guest?.name || "").trim() ||
    String(hub.guest_summary || "")
      .trim()
      .split(/[·|]/)[0]
      ?.trim() ||
    "Guest";

  return {
    hubId: hub.id,
    pnr,
    guestName,
    guestEmail: String(guest?.email || "")
      .trim()
      .toLowerCase(),
    paxLabel: paxLabelFrom(hub, guest),
    primaryCity: String(hub.primary_city || "").trim() || "Japan",
    tourDate,
    earliestTargetDate: earliestDateAmong(items, tourDate),
    tourPaymentStatus: deriveTourPaymentStatus(hub),
    paymentUnlocked: isPaymentUnlockedForTickets(hub),
    paymentLabel: paymentShortLabel(hub),
    ticketStatus: String(hub.ticket_status || "none").trim() || "none",
    bucket,
    items,
    pendingItemCount,
    readyItemCount,
    bonusItemCount,
    totalItemCount: items.length,
  };
}

function ymdToday(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function matchesTicketsMasterFilter(
  card: TicketsMasterCard,
  filter: TicketsMasterFilter
): boolean {
  if (filter === "all") return true;
  return card.bucket === filter;
}

export function filterTicketsMasterCards(
  cards: TicketsMasterCard[],
  filter: TicketsMasterFilter
): TicketsMasterCard[] {
  return cards.filter((c) => matchesTicketsMasterFilter(c, filter));
}

export function countByTicketsMasterFilter(
  cards: TicketsMasterCard[]
): Record<TicketsMasterFilter, number> {
  return {
    all: cards.length,
    ready_to_buy: cards.filter((c) => c.bucket === "ready_to_buy").length,
    payment_locked: cards.filter((c) => c.bucket === "payment_locked").length,
    awaiting_pdf: cards.filter((c) => c.bucket === "awaiting_pdf").length,
    completed: cards.filter((c) => c.bucket === "completed").length,
  };
}

export function buildTicketsMasterSnapshot(input: {
  hubs: OpsHubRow[];
  guestsByPnr?: Record<string, TicketsMasterGuestLookup>;
  now?: Date;
  upcomingDays?: number;
}): TicketsMasterSnapshot {
  const guests = input.guestsByPnr || {};
  const now = input.now || new Date();
  const upcomingDays = input.upcomingDays ?? 14;
  const today = ymdToday(now);
  const end = addDaysYmd(today, upcomingDays);

  const cards: TicketsMasterCard[] = [];
  for (const hub of input.hubs) {
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    const card = buildTicketsMasterCard(hub, pnr ? guests[pnr] : undefined);
    if (card) cards.push(card);
  }

  cards.sort((a, b) => {
    const da = a.earliestTargetDate || "9999-99-99";
    const db = b.earliestTargetDate || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.pnr.localeCompare(b.pnr);
  });

  let pendingPurchases = 0;
  let awaitingPdf = 0;
  let upcomingTargetDates = 0;
  let paymentLocks = 0;

  for (const card of cards) {
    if (card.bucket === "ready_to_buy") {
      pendingPurchases += Math.max(1, card.pendingItemCount);
    }
    if (card.bucket === "awaiting_pdf") {
      awaitingPdf += Math.max(1, card.pendingItemCount);
    }
    if (card.bucket === "payment_locked") {
      paymentLocks += 1;
    }
    const target = card.earliestTargetDate;
    if (
      target &&
      target >= today &&
      target <= end &&
      card.bucket !== "completed"
    ) {
      upcomingTargetDates += 1;
    }
  }

  return {
    kpis: {
      pendingPurchases,
      awaitingPdf,
      upcomingTargetDates,
      paymentLocks,
    },
    cards,
    generatedAt: now.toISOString(),
  };
}

/** Re-export for callers that need item date helper without importing mapper. */
export function procurementItemTargetDate(
  item: ServiceLineItem,
  tourDate?: string | null
): string | null {
  return itemTargetDate(item, normalizeTourDateIso(tourDate) || null);
}
