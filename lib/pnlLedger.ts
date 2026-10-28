/**
 * Executive P&L Financial Ledger — per-PNR inflows/outflows from ops_hub
 * (+ ops_money cost fallback) and ops_hub.extras.agent_services bonuses.
 * No `bookings` collection.
 */

import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  computePendingBalance,
  computeProgress30Target,
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import type { OpsMoneyRow } from "@/lib/opsMoney";
import {
  deriveTourPaymentStatus,
  isConciergeFeeSettled,
  type TourPaymentStatus,
} from "@/lib/tourPaymentStatus";

export type PayoutToggleStatus = "PAID" | "PENDING_MONTHLY";

export type PnlPayoutKey = "guide" | "driver" | "tickets" | "bonus";

export type PnlPayoutsMap = Partial<Record<PnlPayoutKey, PayoutToggleStatus>>;

export type GuestMilestoneKind = "design_fee" | "deposit_30" | "final_balance";

export type GuestMilestone = {
  kind: GuestMilestoneKind;
  label: string;
  amountEur: number;
  /** Amount of this milestone already covered by total_paid_eur */
  receivedEur: number;
  paid: boolean;
  dueLabel?: string;
};

export type CostLine = {
  key: PnlPayoutKey;
  label: string;
  amountJpy: number;
  amountEur: number;
  status: PayoutToggleStatus;
  /** Bonus gift titles for tooltip */
  detail?: string;
};

export type PnrLedgerCard = {
  hubId: string;
  pnr: string;
  guestName: string;
  guestEmail: string;
  tourDate: string | null;
  endDate: string | null;
  status: string;
  tourPaymentStatus: TourPaymentStatus;
  packageTotalEur: number;
  totalPaidEur: number;
  pendingReceivableEur: number;
  milestones: GuestMilestone[];
  costs: CostLine[];
  totalInflowsEur: number;
  totalCostsEur: number;
  netPnrProfitEur: number;
  assignedGuide: string;
  assignedDriver: string;
};

/** Ledger list tabs — derived from real paid/pending signals, not inventing booleans. */
export type PnlListFilter =
  | "all"
  | "active_pending"
  | "outflows_paid"
  | "settled_archived";

export type PnlGuestLookup = {
  name?: string;
  email?: string;
};

/** Any cost line with amount > 0 still PENDING_MONTHLY (extras.pnl_payouts). */
export function hasPendingContractorPayouts(card: PnrLedgerCard): boolean {
  return card.costs.some(
    (c) =>
      (c.amountEur > 0 || c.amountJpy > 0) && c.status === "PENDING_MONTHLY"
  );
}

/** All cost lines with amount > 0 are PAID (or no costs at all). */
export function contractorOutflowsFullySettled(card: PnrLedgerCard): boolean {
  const withAmount = card.costs.filter(
    (c) => c.amountEur > 0 || c.amountJpy > 0
  );
  if (withAmount.length === 0) return true;
  return withAmount.every((c) => c.status === "PAID");
}

/** Guest side closed: FULLY_PAID lane or total_paid ≥ package (when package known). */
export function guestFullySettled(card: PnrLedgerCard): boolean {
  if (card.tourPaymentStatus === "FULLY_PAID") return true;
  if (card.packageTotalEur > 0 && card.pendingReceivableEur <= 0) return true;
  return false;
}

export function matchesPnlListFilter(
  card: PnrLedgerCard,
  filter: PnlListFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active_pending":
      // Outstanding contractor payments OR guest balances remaining
      return hasPendingContractorPayouts(card) || card.pendingReceivableEur > 0;
    case "outflows_paid":
      // Contractor outflows fully settled (has costs paid, or zero-cost PNRs that are settled)
      return (
        contractorOutflowsFullySettled(card) &&
        card.costs.some((c) => c.amountEur > 0 || c.amountJpy > 0)
      );
    case "settled_archived":
      // Guest fully paid AND contractors settled — 0 pending either side
      return (
        guestFullySettled(card) &&
        contractorOutflowsFullySettled(card) &&
        card.pendingReceivableEur <= 0 &&
        !hasPendingContractorPayouts(card)
      );
    default:
      return true;
  }
}

export function filterPnrCards(
  cards: PnrLedgerCard[],
  filter: PnlListFilter
): PnrLedgerCard[] {
  return cards.filter((c) => matchesPnlListFilter(c, filter));
}

export function countByPnlFilter(
  cards: PnrLedgerCard[]
): Record<PnlListFilter, number> {
  return {
    all: cards.length,
    active_pending: cards.filter((c) =>
      matchesPnlListFilter(c, "active_pending")
    ).length,
    outflows_paid: cards.filter((c) =>
      matchesPnlListFilter(c, "outflows_paid")
    ).length,
    settled_archived: cards.filter((c) =>
      matchesPnlListFilter(c, "settled_archived")
    ).length,
  };
}

export type PnlKpis = {
  grossCollectedEur: number;
  pendingReceivablesEur: number;
  contractorOutflowsPaidEur: number;
  pendingMonthlyPayoutsEur: number;
  netCompanyProfitEur: number;
  pnrCount: number;
  eurJpy: number | null;
};

export type PnlLedgerSnapshot = {
  kpis: PnlKpis;
  cards: PnrLedgerCard[];
  generatedAt: string;
};

function rawExtrasObject(existing: unknown): Record<string, unknown> {
  if (typeof existing === "string") {
    try {
      return JSON.parse(existing) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (existing && typeof existing === "object") {
    return { ...(existing as Record<string, unknown>) };
  }
  return {};
}

export function parsePnlPayouts(extras: unknown): PnlPayoutsMap {
  const base = rawExtrasObject(extras);
  const block = base.pnl_payouts;
  if (!block || typeof block !== "object") return {};
  const o = block as Record<string, unknown>;
  const out: PnlPayoutsMap = {};
  for (const key of ["guide", "driver", "tickets", "bonus"] as PnlPayoutKey[]) {
    const v = String(o[key] || "")
      .trim()
      .toUpperCase();
    if (v === "PAID") out[key] = "PAID";
    else if (v === "PENDING_MONTHLY" || v === "PENDING")
      out[key] = "PENDING_MONTHLY";
  }
  return out;
}

/** Merge pnl_payouts into extras without dropping agent_services / dispatch / comms. */
export function mergePnlPayoutsIntoExtras(
  existing: unknown,
  patch: PnlPayoutsMap
): Record<string, unknown> {
  const base = rawExtrasObject(existing);
  const parsed = parseOpsHubExtras(existing);
  const prev = parsePnlPayouts(existing);
  return {
    ...base,
    agent_services: parsed.agent_services || base.agent_services || [],
    final_approved_price:
      parsed.final_approved_price ?? base.final_approved_price ?? null,
    price_mode: parsed.price_mode ?? base.price_mode,
    pending_discount_request:
      parsed.pending_discount_request ?? base.pending_discount_request ?? null,
    pnl_payouts: {
      ...prev,
      ...patch,
    },
  };
}

export async function persistPnlPayoutStatus(
  pb: PocketBase,
  hub: OpsHubRow,
  key: PnlPayoutKey,
  status: PayoutToggleStatus
): Promise<OpsHubRow> {
  const extras = mergePnlPayoutsIntoExtras(hub.extras, { [key]: status });
  return (await pb.collection("ops_hub").update(
    hub.id,
    { extras },
    { requestKey: null }
  )) as OpsHubRow;
}

/** Company cost of bonus gifts — client price is €0; use listed/base cost. */
export function bonusCostEurFromServices(
  services: ServiceLineItem[] | undefined | null
): { totalEur: number; titles: string[] } {
  let totalEur = 0;
  const titles: string[] = [];
  for (const item of services || []) {
    if (!item.isBonus) continue;
    if (item.status === "DECLINED") continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    // Prefer catalog/list cost (base); final is forced 0 for bonuses
    const unit = Math.max(
      0,
      Math.round(
        Number(item.basePriceEur) ||
          Number((item as { listPriceEur?: number }).listPriceEur) ||
          0
      )
    );
    const line = unit * qty;
    if (line <= 0) continue;
    totalEur += line;
    titles.push(item.title);
  }
  return { totalEur: roundEur(totalEur), titles };
}

export function jpyToEur(jpy: number, eurJpy: number | null | undefined): number {
  const rate = eurJpy != null && eurJpy > 0 ? eurJpy : null;
  if (rate == null) return 0;
  return roundEur(Math.max(0, Number(jpy) || 0) / rate);
}

function pickCostJpy(
  hubVal: number | null | undefined,
  moneyVal: number | null | undefined
): number {
  const h = Math.max(0, Number(hubVal) || 0);
  if (h > 0) return h;
  return Math.max(0, Number(moneyVal) || 0);
}

function guestNameFrom(
  hub: OpsHubRow,
  guestsByPnr?: Record<string, PnlGuestLookup>
): string {
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase();
  const fromGuest = guestsByPnr?.[pnr]?.name;
  if (fromGuest) return fromGuest;
  const summary = String(hub.guest_summary || "").trim();
  if (summary) {
    const first = summary.split(/[·|]/)[0]?.trim();
    if (first) return first.length > 40 ? `${first.slice(0, 37)}…` : first;
  }
  return "Guest";
}

function guestEmailFrom(
  hub: OpsHubRow,
  guestsByPnr?: Record<string, PnlGuestLookup>
): string {
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase();
  return String(guestsByPnr?.[pnr]?.email || "").trim().toLowerCase();
}

function buildMilestones(hub: OpsHubRow): GuestMilestone[] {
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  const totalPaid = roundEur(Number(hub.total_paid_eur) || 0);
  const feeEur = roundEur(
    Number(hub.concierge_fee_amount) ||
      Number(hub.deposit_amount) ||
      DEFAULT_CONCIERGE_FEE_EUR
  );
  const progress30 = packageTotal > 0 ? computeProgress30Target(packageTotal) : 0;
  const finalAmount =
    packageTotal > 0 ? Math.max(0, packageTotal - progress30) : 0;

  const status = deriveTourPaymentStatus(hub);
  const feeSettled = isConciergeFeeSettled(hub);
  const badge =
    packageTotal > 0 && totalPaid > 0
      ? paymentBadgeForAmount(totalPaid, packageTotal)
      : null;

  const deposit30Paid =
    status === "PARTIALLY_PAID" ||
    status === "FULLY_PAID" ||
    Boolean(badge?.milestone30Met) ||
    (progress30 > 0 && totalPaid >= progress30);

  const finalPaid =
    status === "FULLY_PAID" ||
    Boolean(badge?.fullyPaid) ||
    (packageTotal > 0 && totalPaid >= packageTotal);

  const feeReceived = feeSettled
    ? feeEur
    : Math.min(totalPaid, feeEur);
  const depositReceived = deposit30Paid
    ? Math.max(0, progress30 - feeEur)
    : Math.max(0, Math.min(Math.max(0, totalPaid - feeEur), Math.max(0, progress30 - feeEur)));
  const finalReceived = finalPaid
    ? finalAmount
    : Math.max(0, Math.min(Math.max(0, totalPaid - progress30), finalAmount));

  return [
    {
      kind: "design_fee",
      label: "Design Fee",
      amountEur: feeEur,
      receivedEur: roundEur(feeReceived),
      paid: feeSettled || totalPaid >= feeEur,
      dueLabel: "On inquiry",
    },
    {
      kind: "deposit_30",
      label: "30% deposit",
      amountEur: Math.max(0, progress30 - feeEur),
      receivedEur: roundEur(depositReceived),
      paid: deposit30Paid,
      dueLabel: "Date lock",
    },
    {
      kind: "final_balance",
      label: "Final balance",
      amountEur: finalAmount,
      receivedEur: roundEur(finalReceived),
      paid: finalPaid,
      dueLabel: "Pre-tour",
    },
  ];
}

export function buildPnrLedgerCard(input: {
  hub: OpsHubRow;
  money?: OpsMoneyRow | null;
  eurJpy?: number | null;
  guestsByPnr?: Record<string, PnlGuestLookup>;
}): PnrLedgerCard {
  const { hub, money, eurJpy, guestsByPnr } = input;
  const pnr = String(hub.pnr || "")
    .trim()
    .toUpperCase();
  const packageTotal = roundEur(Number(hub.estimated_total_eur) || 0);
  const totalPaid = roundEur(Number(hub.total_paid_eur) || 0);
  const pendingReceivable = computePendingBalance(packageTotal, totalPaid);
  const payouts = parsePnlPayouts(hub.extras);
  const services = parseOpsHubExtras(hub.extras).agent_services || [];
  const bonus = bonusCostEurFromServices(services);

  const guideJpy = pickCostJpy(hub.guide_pay_jpy, money?.guide_pay_jpy);
  const driverJpy = pickCostJpy(hub.driver_pay_jpy, money?.driver_pay_jpy);
  const ticketJpy = pickCostJpy(hub.ticket_cost_jpy, money?.ticket_cost_jpy);

  const costs: CostLine[] = [
    {
      key: "guide",
      label: "Guide pay",
      amountJpy: guideJpy,
      amountEur: jpyToEur(guideJpy, eurJpy),
      status: payouts.guide || "PENDING_MONTHLY",
      detail: hub.assigned_guide || money?.assigned_guide || undefined,
    },
    {
      key: "driver",
      label: "Driver pay",
      amountJpy: driverJpy,
      amountEur: jpyToEur(driverJpy, eurJpy),
      status: payouts.driver || "PENDING_MONTHLY",
      detail: hub.assigned_driver || undefined,
    },
    {
      key: "tickets",
      label: "Ticket costs",
      amountJpy: ticketJpy,
      amountEur: jpyToEur(ticketJpy, eurJpy),
      status: payouts.tickets || "PENDING_MONTHLY",
    },
    {
      key: "bonus",
      label: "Bonus gifts",
      amountJpy: 0,
      amountEur: bonus.totalEur,
      status: payouts.bonus || "PENDING_MONTHLY",
      detail: bonus.titles.length ? bonus.titles.join(", ") : undefined,
    },
  ];

  const totalCostsEur = roundEur(
    costs.reduce((s, c) => s + c.amountEur, 0)
  );

  return {
    hubId: hub.id,
    pnr,
    guestName: guestNameFrom(hub, guestsByPnr),
    guestEmail: guestEmailFrom(hub, guestsByPnr),
    tourDate: hub.tour_date ? String(hub.tour_date).slice(0, 10) : null,
    endDate: hub.end_date ? String(hub.end_date).slice(0, 10) : null,
    status: toCanonicalStatus(hub.status || "draft"),
    tourPaymentStatus: deriveTourPaymentStatus(hub),
    packageTotalEur: packageTotal,
    totalPaidEur: totalPaid,
    pendingReceivableEur: pendingReceivable,
    milestones: buildMilestones(hub),
    costs,
    totalInflowsEur: totalPaid,
    totalCostsEur,
    netPnrProfitEur: roundEur(totalPaid - totalCostsEur),
    assignedGuide: String(hub.assigned_guide || money?.assigned_guide || "").trim(),
    assignedDriver: String(hub.assigned_driver || "").trim(),
  };
}

export function buildPnlLedgerSnapshot(input: {
  hubs: OpsHubRow[];
  moneyByPnr?: Record<string, OpsMoneyRow>;
  guestsByPnr?: Record<string, PnlGuestLookup>;
  eurJpy?: number | null;
  now?: Date;
}): PnlLedgerSnapshot {
  const moneyByPnr = input.moneyByPnr || {};
  const cards: PnrLedgerCard[] = [];

  for (const hub of input.hubs) {
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    if (toCanonicalStatus(hub.status) === "cancelled") continue;
    cards.push(
      buildPnrLedgerCard({
        hub,
        money: moneyByPnr[pnr] || null,
        eurJpy: input.eurJpy,
        guestsByPnr: input.guestsByPnr,
      })
    );
  }

  cards.sort((a, b) => {
    const da = a.tourDate || "";
    const db = b.tourDate || "";
    if (da !== db) return db.localeCompare(da);
    return a.pnr.localeCompare(b.pnr);
  });

  let grossCollectedEur = 0;
  let pendingReceivablesEur = 0;
  let contractorOutflowsPaidEur = 0;
  let pendingMonthlyPayoutsEur = 0;
  let totalCostsEur = 0;

  for (const card of cards) {
    grossCollectedEur += card.totalInflowsEur;
    pendingReceivablesEur += card.pendingReceivableEur;
    totalCostsEur += card.totalCostsEur;
    for (const c of card.costs) {
      if (c.amountEur <= 0) continue;
      if (c.status === "PAID") contractorOutflowsPaidEur += c.amountEur;
      else pendingMonthlyPayoutsEur += c.amountEur;
    }
  }

  return {
    kpis: {
      grossCollectedEur: roundEur(grossCollectedEur),
      pendingReceivablesEur: roundEur(pendingReceivablesEur),
      contractorOutflowsPaidEur: roundEur(contractorOutflowsPaidEur),
      pendingMonthlyPayoutsEur: roundEur(pendingMonthlyPayoutsEur),
      netCompanyProfitEur: roundEur(grossCollectedEur - totalCostsEur),
      pnrCount: cards.length,
      eurJpy:
        input.eurJpy != null && input.eurJpy > 0 ? input.eurJpy : null,
    },
    cards,
    generatedAt: (input.now || new Date()).toISOString(),
  };
}

/** Sync cost JPY onto ops_hub (source of truth for CEO/P&L) + ops_money pocket. */
export async function persistPnrCostAmounts(
  pb: PocketBase,
  opts: {
    hub: OpsHubRow;
    guidePayJpy: number;
    driverPayJpy: number;
    ticketCostJpy: number;
    tourCount?: number;
  }
): Promise<void> {
  const patch = {
    guide_pay_jpy: Math.max(0, Math.round(opts.guidePayJpy) || 0),
    driver_pay_jpy: Math.max(0, Math.round(opts.driverPayJpy) || 0),
    ticket_cost_jpy: Math.max(0, Math.round(opts.ticketCostJpy) || 0),
    ...(opts.tourCount != null
      ? { tour_count: Math.max(0, Math.round(opts.tourCount) || 0) }
      : {}),
  };
  await pb.collection("ops_hub").update(opts.hub.id, patch, {
    requestKey: null,
  });
  try {
    const { updateMoneyByPnr } = await import("@/lib/opsMoney");
    await updateMoneyByPnr(pb, opts.hub.pnr, patch);
  } catch {
    /* ops_money optional */
  }
}
