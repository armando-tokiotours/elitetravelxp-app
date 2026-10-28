/**
 * Super User Agency Intelligence & Revenue Desk — aggregation helpers.
 * Sources: agencies, agency_orders, ops_hub (source=agency), agency_monthly_invoices.
 */

import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  deriveTourPaymentStatus,
  type TourPaymentStatus,
} from "@/lib/tourPaymentStatus";
import type { AgencyMonthlyInvoice } from "@/lib/pricing/settlements";

export type AgencyOrderFilter =
  | "all"
  | "pending_payment"
  | "paid_active"
  | "completed";

export type AgencyAccountStatus =
  | "Active"
  | "Pending Review"
  | "Suspended"
  | string;

export type AgencyPartnerRow = {
  id: string;
  name: string;
  code?: string;
  contact_email?: string;
  phone?: string;
  address?: string;
  country?: string;
  website?: string;
  vat_number?: string;
  bank_info?: string;
  payment_terms?: string;
  ops_contact_name?: string;
  ops_contact_email?: string;
  ops_contact_phone?: string;
  billing_contact_name?: string;
  billing_contact_email?: string;
  billing_contact_phone?: string;
  preferred_currency?: string;
  payment_method?: string;
  commission_rate_percentage?: number;
  account_status?: AgencyAccountStatus;
  active?: boolean;
  notes?: string;
};

export type AgencyOrderRaw = {
  id: string;
  booking_ref?: string;
  agency_id?: string;
  agency_name?: string;
  contact_email?: string;
  status?: string;
  tour_date?: string;
  primary_city?: string;
  guests?: unknown;
  notes?: string;
  created?: string;
  updated?: string;
};

export type AgencyOrderLane =
  | "pending_payment"
  | "paid_active"
  | "completed";

export type AgencyOrderCard = {
  id: string;
  pnr: string;
  agencyId: string;
  agencyName: string;
  status: string;
  lane: AgencyOrderLane;
  primaryCity: string;
  tourDate: string | null;
  contactEmail: string;
  guestLabel: string;
  notes: string;
  tourPaymentStatus: TourPaymentStatus | "UNKNOWN";
  paidEur: number;
  estimatedEur: number;
  pendingEur: number;
  hubId: string | null;
};

export type AgencyCardStats = {
  agency: AgencyPartnerRow;
  orderCount: number;
  activeCount: number;
  completedCount: number;
  pendingPaymentCount: number;
  totalRevenueEur: number;
  paidEur: number;
  pendingEur: number;
  commissionRate: number;
  orders: AgencyOrderCard[];
};

export type AgencyIntelligenceKpis = {
  partnerAgencies: number;
  totalBookings: number;
  activeB2bOrders: number;
  pendingReceivablesEur: number;
  settledRevenueEur: number;
};

export type AgencyIntelligenceSnapshot = {
  kpis: AgencyIntelligenceKpis;
  agencyCards: AgencyCardStats[];
  orders: AgencyOrderCard[];
  filterCounts: Record<AgencyOrderFilter, number>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function guestLabelFromOrder(order: AgencyOrderRaw, hub?: OpsHubRow | null): string {
  const g = order.guests;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const obj = g as Record<string, unknown>;
    const adults = num(obj.adults);
    const kids = num(obj.kids ?? obj.children);
    const bits = [
      adults ? `${adults} adults` : "",
      kids ? `${kids} kids` : "",
    ].filter(Boolean);
    if (bits.length) return bits.join(", ");
  }
  const summary = String(hub?.guest_summary || "").trim();
  if (summary) return summary;
  return String(order.contact_email || "").trim() || "—";
}

function normalizeOrderStatus(status?: string | null): string {
  return String(status || "incoming")
    .trim()
    .toLowerCase();
}

/** Map order + hub payment into desk filter lanes. */
export function classifyAgencyOrderLane(
  orderStatus: string,
  pay: TourPaymentStatus | "UNKNOWN"
): AgencyOrderLane {
  const s = normalizeOrderStatus(orderStatus);
  if (s === "done" || s === "cancelled") return "completed";
  if (pay === "FULLY_PAID" || pay === "PARTIALLY_PAID") return "paid_active";
  if (s === "confirmed" || s === "in_ops") return "paid_active";
  return "pending_payment";
}

function invoicePending(status?: string | null): boolean {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  return (
    !s ||
    s === "draft" ||
    s === "sent" ||
    s === "partially_paid" ||
    s === "overdue"
  );
}

function invoiceSettled(status?: string | null): boolean {
  return (
    String(status || "")
      .trim()
      .toLowerCase() === "paid"
  );
}

function resolveAgencyId(
  order: AgencyOrderRaw,
  agenciesById: Map<string, AgencyPartnerRow>,
  agenciesByName: Map<string, AgencyPartnerRow>
): string {
  const byId = String(order.agency_id || "").trim();
  if (byId && agenciesById.has(byId)) return byId;
  if (byId) return byId;
  const name = String(order.agency_name || "")
    .trim()
    .toLowerCase();
  if (name && agenciesByName.has(name)) {
    return agenciesByName.get(name)!.id;
  }
  return "";
}

export function buildAgencyOrderCard(
  order: AgencyOrderRaw,
  hub: OpsHubRow | null | undefined,
  agencyNameFallback: string
): AgencyOrderCard {
  const pnr = String(order.booking_ref || "")
    .trim()
    .toUpperCase();
  const status = normalizeOrderStatus(order.status || hub?.status);
  let pay: TourPaymentStatus | "UNKNOWN" = "UNKNOWN";
  if (hub) {
    pay = deriveTourPaymentStatus(hub);
  }
  const paidEur = hub ? Math.max(0, num(hub.total_paid_eur)) : 0;
  const estimatedEur = hub ? Math.max(0, num(hub.estimated_total_eur)) : 0;
  const pendingEur =
    estimatedEur > 0 ? Math.max(0, estimatedEur - paidEur) : 0;

  return {
    id: order.id,
    pnr,
    agencyId: String(order.agency_id || "").trim(),
    agencyName:
      String(order.agency_name || "").trim() || agencyNameFallback || "Agency",
    status,
    lane: classifyAgencyOrderLane(status, pay),
    primaryCity: String(order.primary_city || hub?.primary_city || "").trim(),
    tourDate: String(order.tour_date || hub?.tour_date || "").slice(0, 10) || null,
    contactEmail: String(order.contact_email || "").trim().toLowerCase(),
    guestLabel: guestLabelFromOrder(order, hub),
    notes: String(order.notes || "").trim(),
    tourPaymentStatus: pay,
    paidEur,
    estimatedEur,
    pendingEur,
    hubId: hub?.id || null,
  };
}

/**
 * Build executive snapshot from live PB rows.
 * When invoice amounts are zero/missing, KPIs fall back to ops_hub paid/pending.
 */
export function buildAgencyIntelligenceSnapshot(input: {
  agencies: AgencyPartnerRow[];
  orders: AgencyOrderRaw[];
  hubs: OpsHubRow[];
  invoices?: AgencyMonthlyInvoice[];
}): AgencyIntelligenceSnapshot {
  const agenciesById = new Map(
    input.agencies.map((a) => [a.id, a] as const)
  );
  const agenciesByName = new Map(
    input.agencies
      .filter((a) => a.name)
      .map((a) => [a.name.trim().toLowerCase(), a] as const)
  );

  const hubByPnr = new Map<string, OpsHubRow>();
  for (const hub of input.hubs) {
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    // Prefer agency-sourced hubs when duplicates exist
    const prev = hubByPnr.get(pnr);
    if (!prev || String(hub.source || "") === "agency") {
      hubByPnr.set(pnr, hub);
    }
  }

  const orders: AgencyOrderCard[] = input.orders.map((raw) => {
    const agencyId = resolveAgencyId(raw, agenciesById, agenciesByName);
    const agency = agencyId ? agenciesById.get(agencyId) : undefined;
    const pnr = String(raw.booking_ref || "")
      .trim()
      .toUpperCase();
    const hub = pnr ? hubByPnr.get(pnr) : undefined;
    const card = buildAgencyOrderCard(
      { ...raw, agency_id: agencyId || raw.agency_id },
      hub,
      agency?.name || String(raw.agency_name || "")
    );
    return { ...card, agencyId: agencyId || card.agencyId };
  });

  // Orphan agency hubs with no agency_orders row still count as B2B workload
  const orderPnrs = new Set(orders.map((o) => o.pnr).filter(Boolean));
  for (const hub of input.hubs) {
    if (String(hub.source || "") !== "agency") continue;
    const pnr = String(hub.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr || orderPnrs.has(pnr)) continue;
    const status = normalizeOrderStatus(hub.status);
    const pay = deriveTourPaymentStatus(hub);
    const paidEur = Math.max(0, num(hub.total_paid_eur));
    const estimatedEur = Math.max(0, num(hub.estimated_total_eur));
    orders.push({
      id: `hub:${hub.id}`,
      pnr,
      agencyId: "",
      agencyName: "Agency (hub)",
      status,
      lane: classifyAgencyOrderLane(status, pay),
      primaryCity: String(hub.primary_city || "").trim(),
      tourDate: String(hub.tour_date || "").slice(0, 10) || null,
      contactEmail: "",
      guestLabel: String(hub.guest_summary || "").trim() || "—",
      notes: "",
      tourPaymentStatus: pay,
      paidEur,
      estimatedEur,
      pendingEur:
        estimatedEur > 0 ? Math.max(0, estimatedEur - paidEur) : 0,
      hubId: hub.id,
    });
  }

  orders.sort((a, b) => {
    const da = a.tourDate || "";
    const db = b.tourDate || "";
    if (da !== db) return da.localeCompare(db);
    return a.pnr.localeCompare(b.pnr);
  });

  const byAgency = new Map<string, AgencyOrderCard[]>();
  for (const o of orders) {
    const key = o.agencyId || `__name:${o.agencyName.toLowerCase()}`;
    const list = byAgency.get(key) || [];
    list.push(o);
    byAgency.set(key, list);
  }

  const agencyCards: AgencyCardStats[] = input.agencies
    .map((agency) => {
      const mine = byAgency.get(agency.id) || [];
      // Also pick up name-keyed orphans that match this agency
      const nameKey = `__name:${agency.name.trim().toLowerCase()}`;
      const named = byAgency.get(nameKey) || [];
      const combined = [...mine];
      for (const o of named) {
        if (!combined.some((x) => x.id === o.id)) combined.push(o);
      }
      const paidEur = combined.reduce((s, o) => s + o.paidEur, 0);
      const pendingEur = combined.reduce((s, o) => s + o.pendingEur, 0);
      const totalRevenueEur = combined.reduce(
        (s, o) => s + (o.estimatedEur > 0 ? o.estimatedEur : o.paidEur),
        0
      );
      return {
        agency,
        orderCount: combined.length,
        activeCount: combined.filter((o) => o.lane !== "completed").length,
        completedCount: combined.filter((o) => o.lane === "completed").length,
        pendingPaymentCount: combined.filter(
          (o) => o.lane === "pending_payment"
        ).length,
        totalRevenueEur,
        paidEur,
        pendingEur,
        commissionRate: num(agency.commission_rate_percentage),
        orders: combined,
      };
    })
    .sort((a, b) => {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
      return a.agency.name.localeCompare(b.agency.name);
    });

  const invoices = input.invoices || [];
  let pendingReceivablesEur = invoices
    .filter((inv) => invoicePending(inv.invoice_status))
    .reduce((s, inv) => s + num(inv.total_amount_due), 0);
  let settledRevenueEur = invoices
    .filter((inv) => invoiceSettled(inv.invoice_status))
    .reduce((s, inv) => s + num(inv.total_amount_due), 0);

  // Graceful fallback when invoices are empty / zeroed drafts
  if (pendingReceivablesEur <= 0 && settledRevenueEur <= 0) {
    pendingReceivablesEur = orders.reduce((s, o) => s + o.pendingEur, 0);
    settledRevenueEur = orders.reduce((s, o) => s + o.paidEur, 0);
  }

  const activeB2bOrders = orders.filter((o) => o.lane !== "completed").length;

  const filterCounts: Record<AgencyOrderFilter, number> = {
    all: orders.length,
    pending_payment: orders.filter((o) => o.lane === "pending_payment").length,
    paid_active: orders.filter((o) => o.lane === "paid_active").length,
    completed: orders.filter((o) => o.lane === "completed").length,
  };

  return {
    kpis: {
      partnerAgencies: input.agencies.length,
      totalBookings: orders.length,
      activeB2bOrders,
      pendingReceivablesEur,
      settledRevenueEur,
    },
    agencyCards,
    orders,
    filterCounts,
  };
}

export function filterAgencyOrders(
  orders: AgencyOrderCard[],
  filter: AgencyOrderFilter,
  query: string
): AgencyOrderCard[] {
  const needle = query.trim().toLowerCase();
  return orders.filter((o) => {
    if (filter !== "all" && o.lane !== filter) return false;
    if (!needle) return true;
    const hay = [
      o.pnr,
      o.agencyName,
      o.contactEmail,
      o.guestLabel,
      o.primaryCity,
      o.status,
      o.notes,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function formatAgencyEur(n: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
