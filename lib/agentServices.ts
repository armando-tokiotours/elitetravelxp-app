/**
 * Agent-managed invoice line items (custom extras, price overrides, complimentary bonuses).
 * Persisted on ops_hub.extras.agent_services by PNR.
 */

import type { InvoiceItem } from "@/components/invoice/ItemizedInvoiceTable";

export type AgentServiceCategory =
  | "TOUR"
  | "TRANSPORT"
  | "TICKET"
  | "CONCIERGE_EXTRA";

export type ServiceLineItem = {
  id: string;
  title: string;
  category: AgentServiceCategory;
  basePriceEur: number;
  finalPriceEur: number;
  /** Optional estimate ceiling (defaults to final × 1.3 on invoice brief) */
  estimateMaxEur?: number;
  isBonus: boolean;
  status: "ACCEPTED" | "DECLINED" | "OPTIONAL";
  addedByAgent: string;
  notes?: string;
  /** When set, overrides a catalog invoice row with the same id */
  overridesItemId?: string;
  /** PocketBase catalog source id (tour / transport product) */
  catalogSourceId?: string;
  quantity?: number;
  /** Awaiting Ops Manager override for >15% discount */
  approvalPending?: boolean;
};

export type AgentServicesExtras = {
  agent_services?: ServiceLineItem[];
  final_approved_price?: number | null;
  pending_discount_request?: {
    requestedTotal: number;
    originalTotal: number;
    requestedAt: string;
    requestedBy?: string;
  } | null;
};

/** Max agent self-serve discount without Ops Manager approval */
export const MAX_AGENT_DISCOUNT_PCT = 15;

export type CartCatalogItem = {
  id: string;
  title: string;
  category: AgentServiceCategory;
  priceEur: number;
  subtitle?: string;
};

export function itemDiscountPercent(item: ServiceLineItem): number {
  if (item.isBonus) return 0;
  const base = Math.max(0, Number(item.basePriceEur) || 0);
  if (base <= 0) return 0;
  const final = Math.max(0, Number(item.finalPriceEur) || 0);
  if (final >= base) return 0;
  return Math.round(((base - final) / base) * 100);
}

export function itemExceedsAgentDiscount(item: ServiceLineItem): boolean {
  return itemDiscountPercent(item) > MAX_AGENT_DISCOUNT_PCT;
}

/** Billable cart lines only (bonuses excluded from 15% math). */
export function cartBillableTotals(cart: ServiceLineItem[]): {
  originalTotal: number;
  currentTotal: number;
  maxAllowedDiscountPrice: number;
  discountPct: number;
  requiresOpsApproval: boolean;
} {
  const billable = cart.filter(
    (i) => i.status === "ACCEPTED" && !i.isBonus
  );
  const qty = (i: ServiceLineItem) => Math.max(1, Math.round(Number(i.quantity) || 1));
  const originalTotal = billable.reduce(
    (acc, i) => acc + Math.max(0, Math.round(i.basePriceEur || 0)) * qty(i),
    0
  );
  const currentTotal = billable.reduce(
    (acc, i) => acc + Math.max(0, Math.round(i.finalPriceEur || 0)) * qty(i),
    0
  );
  const maxAllowedDiscountPrice = Math.round(
    originalTotal * (1 - MAX_AGENT_DISCOUNT_PCT / 100)
  );
  const discountPct =
    originalTotal > 0
      ? Math.round(((originalTotal - currentTotal) / originalTotal) * 100)
      : 0;
  const requiresOpsApproval =
    originalTotal > 0 && currentTotal < maxAllowedDiscountPrice;
  return {
    originalTotal,
    currentTotal,
    maxAllowedDiscountPrice,
    discountPct,
    requiresOpsApproval,
  };
}

export function canBypassDiscountGuard(
  role: string | null | undefined
): boolean {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "ops" || r === "super_user" || r === "ops_manager";
}

export function mapCatalogCategory(
  raw: string | null | undefined
): AgentServiceCategory {
  const v = String(raw || "").toLowerCase();
  if (v.includes("suica") || v.includes("ic card") || v.includes("ic-card")) {
    return "TICKET";
  }
  if (
    v.includes("transport") ||
    v.includes("transit") ||
    v.includes("van") ||
    v.includes("chauffeur") ||
    v.includes("alphard") ||
    v.includes("hiace") ||
    v.includes("shinkansen") ||
    v.includes("transfer")
  ) {
    return "TRANSPORT";
  }
  if (
    v.includes("ticket") ||
    v.includes("admission") ||
    v.includes("activity") ||
    v.includes("place") ||
    v.includes("teamlab")
  ) {
    return "TICKET";
  }
  if (v.includes("concierge") || v.includes("service")) {
    return "CONCIERGE_EXTRA";
  }
  return "TOUR";
}

const CATEGORIES: AgentServiceCategory[] = [
  "TOUR",
  "TRANSPORT",
  "TICKET",
  "CONCIERGE_EXTRA",
];

export function categoryLabel(cat: AgentServiceCategory | string): string {
  switch (String(cat || "").toUpperCase()) {
    case "TOUR":
      return "Tours";
    case "TRANSPORT":
      return "Transit";
    case "TICKET":
      return "Ticket / extra";
    case "CONCIERGE_EXTRA":
      return "Concierge extra";
    default:
      return String(cat || "Extra");
  }
}

export function parseOpsHubExtras(raw: unknown): AgentServicesExtras {
  if (!raw) return {};
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }

  const list = Array.isArray(obj.agent_services) ? obj.agent_services : [];
  const agent_services: ServiceLineItem[] = [];
  for (const row of list) {
    const parsed = normalizeServiceLineItem(row);
    if (parsed) agent_services.push(parsed);
  }

  const approved = obj.final_approved_price;
  const final_approved_price =
    approved == null || approved === ""
      ? null
      : Number.isFinite(Number(approved))
        ? Math.round(Number(approved))
        : null;

  let pending_discount_request: AgentServicesExtras["pending_discount_request"] =
    null;
  const pending = obj.pending_discount_request;
  if (pending && typeof pending === "object") {
    const p = pending as Record<string, unknown>;
    pending_discount_request = {
      requestedTotal: Math.round(Number(p.requestedTotal) || 0),
      originalTotal: Math.round(Number(p.originalTotal) || 0),
      requestedAt: String(p.requestedAt || ""),
      requestedBy: String(p.requestedBy || "").trim() || undefined,
    };
  }

  return { agent_services, final_approved_price, pending_discount_request };
}

export function normalizeServiceLineItem(raw: unknown): ServiceLineItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = String(r.title || "").trim();
  if (!title) return null;
  const catRaw = String(r.category || "CONCIERGE_EXTRA")
    .trim()
    .toUpperCase() as AgentServiceCategory;
  const category = CATEGORIES.includes(catRaw) ? catRaw : "CONCIERGE_EXTRA";
  const isBonus = Boolean(r.isBonus ?? r.is_bonus ?? r.complimentary);
  const base = Math.max(0, Math.round(Number(r.basePriceEur ?? r.base_price_eur) || 0));
  const finalRaw = Number(r.finalPriceEur ?? r.final_price_eur);
  const finalPriceEur = isBonus
    ? 0
    : Number.isFinite(finalRaw)
      ? Math.max(0, Math.round(finalRaw))
      : base;
  const statusRaw = String(r.status || "ACCEPTED")
    .trim()
    .toUpperCase();
  const status =
    statusRaw === "DECLINED" || statusRaw === "OPTIONAL"
      ? statusRaw
      : "ACCEPTED";

  return {
    id: String(r.id || `custom-${Date.now()}`).trim() || `custom-${Date.now()}`,
    title,
    category,
    basePriceEur: base,
    finalPriceEur,
    estimateMaxEur: (() => {
      const maxRaw = Number(r.estimateMaxEur ?? r.estimate_max_eur);
      if (Number.isFinite(maxRaw) && maxRaw > 0) return Math.round(maxRaw);
      return Math.round(finalPriceEur * 1.3);
    })(),
    isBonus,
    status,
    addedByAgent: String(r.addedByAgent || r.added_by_agent || "Ops Agent").trim(),
    notes: String(r.notes || "").trim() || undefined,
    overridesItemId: String(r.overridesItemId || r.overrides_item_id || "").trim() || undefined,
    catalogSourceId:
      String(r.catalogSourceId || r.catalog_source_id || "").trim() || undefined,
    quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
    approvalPending: Boolean(r.approvalPending || r.approval_pending),
  };
}

export function mergeExtrasPatch(
  existing: unknown,
  patch: Partial<AgentServicesExtras>
): AgentServicesExtras {
  const base = parseOpsHubExtras(existing);
  return {
    agent_services:
      patch.agent_services !== undefined
        ? patch.agent_services
        : base.agent_services || [],
    final_approved_price:
      patch.final_approved_price !== undefined
        ? patch.final_approved_price
        : base.final_approved_price ?? null,
    pending_discount_request:
      patch.pending_discount_request !== undefined
        ? patch.pending_discount_request
        : base.pending_discount_request ?? null,
  };
}

export function agentServiceToInvoiceItem(item: ServiceLineItem): InvoiceItem {
  const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
  const unit = item.isBonus ? 0 : item.finalPriceEur;
  return {
    id: item.id,
    title: qty > 1 ? `${item.title} ×${qty}` : item.title,
    category: categoryLabel(item.category),
    status: item.status,
    basePriceEur: unit * qty,
    notes:
      item.notes ||
      (item.isBonus
        ? "🎁 Complimentary Bonus granted by Concierge"
        : undefined),
    isBonus: item.isBonus,
    listPriceEur: item.isBonus ? item.basePriceEur * qty : undefined,
  };
}

/**
 * Merge guest-built invoice rows with agent extras:
 * - overridesItemId / matching id → replace price / bonus
 * - other agent lines → append
 */
export function mergeInvoiceWithAgentServices(
  baseItems: InvoiceItem[],
  agentServices: ServiceLineItem[] | null | undefined
): InvoiceItem[] {
  const services = (agentServices || []).filter(Boolean);
  if (services.length === 0) return baseItems;

  const overrideById = new Map<string, ServiceLineItem>();
  const append: ServiceLineItem[] = [];

  for (const s of services) {
    const key = String(s.overridesItemId || s.id || "").trim();
    const isCustom = key.startsWith("custom-") || !key;
    // Custom additives always append; catalog overrides match existing ids
    if (!isCustom && baseItems.some((b) => b.id === key)) {
      overrideById.set(key, s);
    } else if (s.overridesItemId && baseItems.some((b) => b.id === s.overridesItemId)) {
      overrideById.set(s.overridesItemId, s);
    } else {
      append.push(s);
    }
  }

  const merged = baseItems.map((item) => {
    const ov = overrideById.get(item.id);
    if (!ov) return item;
    return {
      ...item,
      title: ov.title || item.title,
      status: ov.status,
      basePriceEur: ov.isBonus ? 0 : ov.finalPriceEur,
      isBonus: ov.isBonus,
      listPriceEur: ov.isBonus ? ov.basePriceEur || item.basePriceEur : undefined,
      notes:
        ov.notes ||
        (ov.isBonus
          ? "🎁 Complimentary Bonus granted by Concierge"
          : item.notes),
    };
  });

  for (const s of append) {
    merged.push(agentServiceToInvoiceItem(s));
  }
  return merged;
}

export function sumAcceptedAgentServicesEur(
  services: ServiceLineItem[] | null | undefined
): number {
  return (services || []).reduce((acc, s) => {
    if (s.status !== "ACCEPTED") return acc;
    if (s.isBonus) return acc;
    const qty = Math.max(1, Math.round(Number(s.quantity) || 1));
    return acc + Math.max(0, Math.round(s.finalPriceEur || 0)) * qty;
  }, 0);
}

export function createCustomServiceLine(input: {
  title: string;
  category?: AgentServiceCategory;
  priceEur?: number;
  estimateMaxEur?: number;
  isBonus?: boolean;
  addedByAgent?: string;
  overridesItemId?: string;
  catalogSourceId?: string;
  notes?: string;
}): ServiceLineItem {
  const isBonus = Boolean(input.isBonus);
  const base = Math.max(0, Math.round(Number(input.priceEur) || 0));
  const max =
    input.estimateMaxEur != null && Number.isFinite(Number(input.estimateMaxEur))
      ? Math.max(base, Math.round(Number(input.estimateMaxEur)))
      : Math.round(base * 1.3);
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(input.title || "").trim(),
    category: input.category || "CONCIERGE_EXTRA",
    basePriceEur: base,
    finalPriceEur: isBonus ? 0 : base,
    estimateMaxEur: isBonus ? 0 : max,
    isBonus,
    status: "ACCEPTED",
    addedByAgent: String(input.addedByAgent || "Ops Agent").trim(),
    notes:
      input.notes ||
      (isBonus
        ? "🎁 Complimentary Bonus granted by Concierge"
        : "Custom Agent Add-on"),
    overridesItemId: input.overridesItemId,
    catalogSourceId: input.catalogSourceId,
    quantity: 1,
  };
}
