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
  /**
   * Optional ticket fulfillment for guest Day Services.
   * Parsed from fulfillment / delivery / issued flags when Ops sets them.
   */
  fulfillmentStatus?: "PENDING" | "READY";
  /**
   * Public URL for the per-line ticket/pass PDF (e.g. /uploads/tickets/...).
   * Never store the binary in PocketBase — URL string only.
   */
  voucherUrl?: string;
  voucherFilename?: string;
  /** Local relative path (or URL) used for cron unlink */
  voucherBlobPathname?: string;
  /** YYYY-MM-DD when this line is for a specific itinerary day */
  serviceDate?: string;
  /** Alias persisted on some older extras payloads */
  scheduledDate?: string;
};

export type PriceMode = "estimate" | "exact";

export type AgentServicesExtras = {
  agent_services?: ServiceLineItem[];
  final_approved_price?: number | null;
  /** Ops Pricing Studio: estimate range vs exact real price per line */
  price_mode?: PriceMode;
  pending_discount_request?: {
    requestedTotal: number;
    originalTotal: number;
    requestedAt: string;
    requestedBy?: string;
  } | null;
};

/** Max agent self-serve discount without Ops Manager approval */
export const MAX_AGENT_DISCOUNT_PCT = 15;
/** Max agent self-serve markup above catalog base (Exact Real Price mode) */
export const MAX_AGENT_INCREASE_PCT = 40;

export type CartCatalogItem = {
  id: string;
  title: string;
  category: AgentServiceCategory;
  priceEur: number;
  subtitle?: string;
  /** Tour marked Bonus gift in Team Access — agent-only until added */
  isCatalogBonus?: boolean;
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

/** Allowed exact-price band vs catalog `basePriceEur` (−15% / +40%). */
export function exactPriceBand(basePriceEur: number): {
  minAllowed: number;
  maxAllowed: number;
} {
  const base = Math.max(0, Math.round(Number(basePriceEur) || 0));
  return {
    minAllowed: Math.round(base * (1 - MAX_AGENT_DISCOUNT_PCT / 100)),
    maxAllowed: Math.round(base * (1 + MAX_AGENT_INCREASE_PCT / 100)),
  };
}

export type ExactPriceBandViolation = {
  item: ServiceLineItem;
  tooLow: boolean;
  tooHigh: boolean;
  minAllowed: number;
  maxAllowed: number;
  standard: number;
  price: number;
};

/** Exact-mode guardrail: −15% / +40% of catalog base. Skips bonus / €0 base. */
export function exactPriceBandViolation(
  item: ServiceLineItem
): ExactPriceBandViolation | null {
  if (item.isBonus) return null;
  const standard = Math.max(0, Math.round(Number(item.basePriceEur) || 0));
  if (standard <= 0) return null;
  const price = Math.max(0, Math.round(Number(item.finalPriceEur) || 0));
  const { minAllowed, maxAllowed } = exactPriceBand(standard);
  const tooLow = price < minAllowed;
  const tooHigh = price > maxAllowed;
  if (!tooLow && !tooHigh) return null;
  return { item, tooLow, tooHigh, minAllowed, maxAllowed, standard, price };
}

export function listExactPriceBandViolations(
  cart: ServiceLineItem[]
): ExactPriceBandViolation[] {
  return cart
    .filter((i) => i.status === "ACCEPTED" || i.status === "OPTIONAL")
    .map((i) => exactPriceBandViolation(i))
    .filter((v): v is ExactPriceBandViolation => v != null);
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

  const modeRaw = String(obj.price_mode || "")
    .trim()
    .toLowerCase();
  const price_mode: PriceMode | undefined =
    modeRaw === "exact" ? "exact" : modeRaw === "estimate" ? "estimate" : undefined;

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

  return {
    agent_services,
    final_approved_price,
    price_mode,
    pending_discount_request,
  };
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

  const fulfillmentRaw = String(
    r.fulfillmentStatus ??
      r.fulfillment_status ??
      r.fulfillment ??
      r.deliveryStatus ??
      r.delivery_status ??
      r.issued ??
      ""
  )
    .trim()
    .toLowerCase();
  const voucherUrl =
    String(
      r.voucherUrl ?? r.voucher_url ?? r.fileUrl ?? r.file_url ?? ""
    ).trim() || undefined;
  const voucherFilename =
    String(
      r.voucherFilename ??
        r.voucher_filename ??
        r.fileName ??
        r.file_name ??
        ""
    ).trim() || undefined;
  const voucherBlobPathname =
    String(
      r.voucherBlobPathname ??
        r.voucher_blob_pathname ??
        r.blobPathname ??
        r.blob_pathname ??
        ""
    ).trim() || undefined;

  const fulfillmentStatus: ServiceLineItem["fulfillmentStatus"] =
    fulfillmentRaw === "ready" ||
    fulfillmentRaw === "delivered" ||
    fulfillmentRaw === "issued" ||
    fulfillmentRaw === "done" ||
    fulfillmentRaw === "true"
      ? "READY"
      : fulfillmentRaw === "pending" || fulfillmentRaw === "false"
        ? "PENDING"
        : voucherUrl
          ? "READY"
          : undefined;

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
    fulfillmentStatus,
    voucherUrl,
    voucherFilename,
    voucherBlobPathname,
    serviceDate:
      String(r.serviceDate ?? r.service_date ?? r.date ?? "")
        .trim()
        .slice(0, 10) || undefined,
    scheduledDate:
      String(r.scheduledDate ?? r.scheduled_date ?? "")
        .trim()
        .slice(0, 10) || undefined,
  };
}

/** Keep cloud voucher fields when a cart replace omits them for the same id. */
export function preserveVoucherFieldsOnReplace(
  incoming: ServiceLineItem[],
  existing: ServiceLineItem[] | null | undefined
): ServiceLineItem[] {
  const byId = new Map((existing || []).map((i) => [i.id, i]));
  return incoming.map((item) => {
    const prev = byId.get(item.id);
    if (!prev?.voucherUrl) return item;
    if (item.voucherUrl) return item;
    return {
      ...item,
      voucherUrl: prev.voucherUrl,
      voucherFilename: prev.voucherFilename || item.voucherFilename,
      voucherBlobPathname:
        prev.voucherBlobPathname || item.voucherBlobPathname,
      fulfillmentStatus:
        item.fulfillmentStatus || prev.fulfillmentStatus || "READY",
    };
  });
}

export function mergeExtrasPatch(
  existing: unknown,
  patch: Partial<AgentServicesExtras>
): Record<string, unknown> {
  let baseObj: Record<string, unknown> = {};
  if (typeof existing === "string") {
    try {
      baseObj = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      baseObj = {};
    }
  } else if (existing && typeof existing === "object") {
    baseObj = { ...(existing as Record<string, unknown>) };
  }
  const base = parseOpsHubExtras(existing);
  return {
    ...baseObj,
    agent_services:
      patch.agent_services !== undefined
        ? patch.agent_services
        : base.agent_services || [],
    final_approved_price:
      patch.final_approved_price !== undefined
        ? patch.final_approved_price
        : base.final_approved_price ?? null,
    price_mode:
      patch.price_mode !== undefined
        ? patch.price_mode
        : base.price_mode ?? undefined,
    pending_discount_request:
      patch.pending_discount_request !== undefined
        ? patch.pending_discount_request
        : base.pending_discount_request ?? null,
  };
}

export function agentServiceToInvoiceItem(item: ServiceLineItem): InvoiceItem {
  const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
  const unit = item.isBonus ? 0 : item.finalPriceEur;
  const maxUnit = item.isBonus
    ? 0
    : item.estimateMaxEur != null && Number.isFinite(item.estimateMaxEur)
      ? Math.max(unit, Math.round(item.estimateMaxEur))
      : Math.round(unit * 1.3);
  return {
    id: item.id,
    title: qty > 1 ? `${item.title} ×${qty}` : item.title,
    category: categoryLabel(item.category),
    status: item.status,
    basePriceEur: unit * qty,
    estimateMaxEur: maxUnit * qty,
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
 * Guest invoice line-item resolver.
 * - When Ops has saved `ops_hub.extras.agent_services`, those rows are the
 *   PocketBase source of truth (guest prefers PB over local quote).
 * - When Ops has saved none, guest keeps the local builder-derived estimate.
 */
export function resolveGuestInvoiceItems(
  localItems: InvoiceItem[],
  agentServices: ServiceLineItem[] | null | undefined
): InvoiceItem[] {
  const services = (agentServices || []).filter(Boolean);
  if (services.length === 0) return localItems;
  return services.map(agentServiceToInvoiceItem);
}

/**
 * Merge guest-built invoice rows with agent extras:
 * - overridesItemId / matching id → replace price / bonus
 * - other agent lines → append
 *
 * Prefer {@link resolveGuestInvoiceItems} for guest dossier invoices so a
 * saved Ops cart fully replaces the local estimate.
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
    const qty = Math.max(1, Math.round(Number(ov.quantity) || 1));
    const unit = ov.isBonus ? 0 : ov.finalPriceEur;
    const maxUnit = ov.isBonus
      ? 0
      : ov.estimateMaxEur != null && Number.isFinite(ov.estimateMaxEur)
        ? Math.max(unit, Math.round(ov.estimateMaxEur))
        : Math.round(unit * 1.3);
    return {
      ...item,
      title: ov.title || item.title,
      status: ov.status,
      basePriceEur: unit * qty,
      estimateMaxEur: maxUnit * qty,
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

/**
 * Guest / invoice exact-pricing detector.
 * True when Ops locked exact mode, deal-lock price is set, or every accepted
 * billable line already has min === max (collapsed ranges).
 */
export function isExactGuestPricing(input: {
  priceMode?: PriceMode | string | null;
  finalApprovedPrice?: number | null;
  items?: Array<{
    status?: string;
    isBonus?: boolean;
    basePriceEur?: number;
    estimateMaxEur?: number;
    minPrice?: number;
    maxPrice?: number;
  }> | null;
}): boolean {
  if (String(input.priceMode || "").trim().toLowerCase() === "exact") {
    return true;
  }
  const approved = Number(input.finalApprovedPrice);
  if (Number.isFinite(approved) && approved > 0) return true;

  const rows = (input.items || []).filter((row) => {
    const status = String(row.status || "ACCEPTED")
      .trim()
      .toUpperCase();
    if (status !== "ACCEPTED") return false;
    if (row.isBonus) return false;
    return true;
  });
  if (rows.length === 0) return false;

  return rows.every((row) => {
    const min =
      row.minPrice != null && Number.isFinite(Number(row.minPrice))
        ? Math.max(0, Math.round(Number(row.minPrice)))
        : Math.max(0, Math.round(Number(row.basePriceEur) || 0));
    const maxRaw =
      row.maxPrice != null && Number.isFinite(Number(row.maxPrice))
        ? Math.round(Number(row.maxPrice))
        : row.estimateMaxEur != null && Number.isFinite(Number(row.estimateMaxEur))
          ? Math.round(Number(row.estimateMaxEur))
          : null;
    if (maxRaw == null) return false;
    return Math.max(min, maxRaw) === min;
  });
}

/**
 * Locked package total for exact guest invoices.
 * Prefer final_approved_price; else sum of accepted line mins.
 */
export function resolveExactPackageTotalEur(input: {
  priceMode?: PriceMode | string | null;
  finalApprovedPrice?: number | null;
  packageMinEur?: number | null;
  items?: Array<{
    status?: string;
    isBonus?: boolean;
    basePriceEur?: number;
    estimateMaxEur?: number;
    minPrice?: number;
    maxPrice?: number;
  }> | null;
}): number | null {
  const approved = Number(input.finalApprovedPrice);
  if (Number.isFinite(approved) && approved > 0) return Math.round(approved);
  if (!isExactGuestPricing(input)) return null;
  const fromPackage = Number(input.packageMinEur);
  if (Number.isFinite(fromPackage) && fromPackage > 0) {
    return Math.round(fromPackage);
  }
  const rows = input.items || [];
  const sum = rows.reduce((acc, row) => {
    const status = String(row.status || "ACCEPTED")
      .trim()
      .toUpperCase();
    if (status !== "ACCEPTED" || row.isBonus) return acc;
    const min =
      row.minPrice != null && Number.isFinite(Number(row.minPrice))
        ? Math.max(0, Math.round(Number(row.minPrice)))
        : Math.max(0, Math.round(Number(row.basePriceEur) || 0));
    return acc + min;
  }, 0);
  return sum > 0 ? sum : null;
}

/** Active cart lines for guest Day Services (exclude declined). */
export function isActiveAgentService(item: ServiceLineItem): boolean {
  return item.status !== "DECLINED";
}

function titleHaystack(item: ServiceLineItem): string {
  return `${item.title || ""} ${item.notes || ""}`.toLowerCase();
}

/**
 * Suica / Pasmo / entry tickets / vouchers — win over car/transit buckets.
 * Matches TICKET / EXTRA categories and title heuristics; excludes private cars.
 */
export function isTicketServiceItem(item: ServiceLineItem): boolean {
  const title = titleHaystack(item);
  const cat = String(item.category || "").toUpperCase();

  // Never treat private-vehicle transfers as tickets
  if (
    title.includes("alphard") ||
    title.includes("hiace") ||
    title.includes("chauffeur") ||
    title.includes("private car") ||
    (title.includes("airport") && title.includes("transfer")) ||
    (title.includes("transfer") &&
      (title.includes("van") || title.includes("vehicle") || title.includes("driver")))
  ) {
    return false;
  }

  if (
    title.includes("suica") ||
    title.includes("pasmo") ||
    title.includes("icoca") ||
    title.includes("ic card") ||
    title.includes("ic-card") ||
    title.includes("iccard") ||
    title.includes("teamlab") ||
    title.includes("museum pass") ||
    title.includes("metro pass") ||
    title.includes("train ticket") ||
    title.includes("rail pass") ||
    title.includes("jr pass") ||
    title.includes("entry ticket") ||
    title.includes("admission") ||
    title.includes("voucher") ||
    /\bticket(s)?\b/.test(title) ||
    /\bentry\b/.test(title)
  ) {
    return true;
  }

  if (cat === "TICKET") return true;
  if (cat === "CONCIERGE_EXTRA" || cat === "EXTRA") {
    return (
      title.includes("pass") ||
      title.includes("entry") ||
      title.includes("ticket") ||
      title.includes("admission")
    );
  }
  return false;
}

/** Private car / vehicle / transfer lines (Alphard, airport transfer, etc.). */
export function isTransitServiceItem(item: ServiceLineItem): boolean {
  // Tickets win — Suica titles often contain "transit" / "transport"
  if (isTicketServiceItem(item)) return false;

  const v = titleHaystack(item);
  const cat = String(item.category || "").toUpperCase();

  if (
    v.includes("alphard") ||
    v.includes("hiace") ||
    v.includes("chauffeur") ||
    v.includes("private car") ||
    v.includes("private driver") ||
    (v.includes("airport") && v.includes("transfer")) ||
    (v.includes("transfer") &&
      (v.includes("van") ||
        v.includes("vehicle") ||
        v.includes("car") ||
        v.includes("driver")))
  ) {
    return true;
  }

  if (cat === "TRANSPORT" || cat === "TRANSIT") {
    // Category alone is not enough when titles are ticket-like (handled above)
    return (
      v.includes("transfer") ||
      v.includes("alphard") ||
      v.includes("hiace") ||
      v.includes("chauffeur") ||
      v.includes("vehicle") ||
      v.includes("van") ||
      v.includes("driver") ||
      v.includes("private") ||
      v.includes("car") ||
      // Generic transport/transit category without ticket keywords
      (!v.includes("suica") &&
        !v.includes("pasmo") &&
        !v.includes("ticket") &&
        !v.includes("pass"))
    );
  }

  return (
    (v.includes("transport") || v.includes("transit")) &&
    (v.includes("private") ||
      v.includes("car") ||
      v.includes("van") ||
      v.includes("vehicle") ||
      v.includes("driver") ||
      v.includes("transfer"))
  );
}

/** Guided tour / guide experience lines (not pure tickets). */
export function isGuideServiceItem(item: ServiceLineItem): boolean {
  if (isTicketServiceItem(item)) return false;
  if (isTransitServiceItem(item)) return false;
  if (item.category === "TOUR") return true;
  const v = titleHaystack(item);
  return (
    v.includes("guide") ||
    v.includes("local host") ||
    v.includes("experience with guide")
  );
}

/** Guest-facing ticket readiness for Day Services rows. */
export function isTicketServiceReady(
  item: ServiceLineItem,
  opts?: { opsTicketStatus?: string | null; hasVoucher?: boolean }
): boolean {
  if (String(item.voucherUrl || "").trim()) return true;
  if (item.fulfillmentStatus === "READY") return true;
  if (item.fulfillmentStatus === "PENDING") return false;
  const notes = String(item.notes || "").toLowerCase();
  if (
    /\b(ready|delivered|issued|done)\b/.test(notes) &&
    !/\bpending\b/.test(notes)
  ) {
    return true;
  }
  const ops = String(opts?.opsTicketStatus || "")
    .trim()
    .toLowerCase();
  if (ops === "done" || opts?.hasVoucher) return true;
  return false;
}

/** Public download URL for a cart ticket line when Ops attached a PDF. */
export function ticketItemVoucherUrl(
  item: ServiceLineItem | null | undefined
): string | null {
  const url = String(item?.voucherUrl || "").trim();
  return url || null;
}

export type DayServicesFromCart = {
  transitItems: ServiceLineItem[];
  guideItems: ServiceLineItem[];
  ticketItems: ServiceLineItem[];
  transitTitle: string | null;
  guideTitle: string | null;
  ticketTitle: string | null;
};

/** Split accepted/optional agent cart into Day Services car / guide / tickets. */
export function dayServicesFromAgentCart(
  services: ServiceLineItem[] | null | undefined
): DayServicesFromCart {
  const active = (services || []).filter(isActiveAgentService);
  // Exclusive buckets — tickets first so Suica never lands under Car
  const ticketItems = active.filter(isTicketServiceItem);
  const transitItems = active.filter(
    (i) => isTransitServiceItem(i) && !isTicketServiceItem(i)
  );
  const guideItems = active.filter(
    (i) =>
      isGuideServiceItem(i) &&
      !isTicketServiceItem(i) &&
      !isTransitServiceItem(i)
  );
  const joinTitles = (items: ServiceLineItem[]) => {
    const titles = items
      .map((i) => String(i.title || "").trim())
      .filter(Boolean);
    if (titles.length === 0) return null;
    return titles.join(" · ");
  };
  return {
    transitItems,
    guideItems,
    ticketItems,
    transitTitle: joinTitles(transitItems),
    guideTitle: joinTitles(guideItems),
    ticketTitle: joinTitles(ticketItems),
  };
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
