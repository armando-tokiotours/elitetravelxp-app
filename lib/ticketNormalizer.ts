/**
 * Shared ticket procurement filter + category engine.
 * Used by Tab 5 (Tickets & Logistics), Tickets Master Desk, and voucher cart API.
 *
 * Sources (in priority order when extracting):
 * 1. ops_hub.extras.agent_services (primary cart)
 * 2. ticket_access_rollup / access_rollup on extras (if present)
 * 3. guest/ops itinerary day tickets (if passed in)
 *
 * Trip-wide Suica / JR Pass MUST stay in procurement (calendar may omit them).
 */

import type { ServiceLineItem } from "@/lib/agentServices";

/** Fine-grained procurement badge categories. */
export type ProcurementTicketCategory =
  | "IC_CARD"
  | "RAIL_PASS"
  | "ATTRACTION"
  | "HOTEL"
  | "GENERAL_TICKET";

/** Coarse UI bucket (icons) — kept for older callers. */
export type ProcurementKind = "ticket" | "transit" | "hotel";

export type ProcurementSource =
  | "agent_services"
  | "access_rollup"
  | "day_ticket";

export type NormalizedProcurementItem = {
  id: string;
  title: string;
  notes: string | null;
  category: ProcurementTicketCategory;
  categoryLabel: string;
  kind: ProcurementKind;
  source: ProcurementSource;
  quantity: number;
  isBonus: boolean;
  serviceDate: string | null;
  scheduledDate: string | null;
  voucherUrl: string | null;
  voucherFilename: string | null;
  voucherBlobPathname: string | null;
  fulfillmentStatus: string | null;
  /** Present when sourced from invoice cart — required for PDF upload. */
  cartItem: ServiceLineItem | null;
  /** Uploadable only when backed by an agent_services line. */
  uploadable: boolean;
};

export type AccessRollupLine = {
  id?: string;
  tourId?: string;
  title?: string;
  name?: string;
  label?: string;
  accessType?: string;
  type?: string;
  serviceDate?: string | null;
  date?: string | null;
  quantity?: number;
  qty?: number;
};

export type DayTicketLine = {
  id?: string;
  title?: string;
  type?: string;
  date?: string | null;
  serviceDate?: string | null;
};

const CATEGORY_LABELS: Record<ProcurementTicketCategory, string> = {
  IC_CARD: "IC card",
  RAIL_PASS: "Rail / transit pass",
  ATTRACTION: "Attraction",
  HOTEL: "Hotel",
  GENERAL_TICKET: "Ticket",
};

/** Tailwind-ish class tokens for badge chrome (consumers compose). */
export const PROCUREMENT_CATEGORY_BADGE: Record<
  ProcurementTicketCategory,
  { label: string; className: string }
> = {
  IC_CARD: {
    label: CATEGORY_LABELS.IC_CARD,
    className:
      "border-sky-500/40 bg-sky-500/15 text-sky-200",
  },
  RAIL_PASS: {
    label: CATEGORY_LABELS.RAIL_PASS,
    className:
      "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  },
  ATTRACTION: {
    label: CATEGORY_LABELS.ATTRACTION,
    className:
      "border-violet-500/40 bg-violet-500/15 text-violet-200",
  },
  HOTEL: {
    label: CATEGORY_LABELS.HOTEL,
    className:
      "border-amber-500/40 bg-amber-500/15 text-amber-200",
  },
  GENERAL_TICKET: {
    label: CATEGORY_LABELS.GENERAL_TICKET,
    className:
      "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  },
};

export function procurementCategoryLabel(
  cat: ProcurementTicketCategory
): string {
  return CATEGORY_LABELS[cat] || CATEGORY_LABELS.GENERAL_TICKET;
}

export function procurementHaystack(
  ...parts: Array<string | null | undefined>
): string {
  return parts
    .map((p) => String(p || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/** Private-vehicle transfers — never procurement tickets. */
export function isPrivateVehicleHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  if (
    v.includes("alphard") ||
    v.includes("hiace") ||
    v.includes("chauffeur") ||
    v.includes("private car") ||
    v.includes("private driver")
  ) {
    return true;
  }
  if (v.includes("airport") && v.includes("transfer")) return true;
  if (
    v.includes("transfer") &&
    (v.includes("van") ||
      v.includes("vehicle") ||
      v.includes("driver") ||
      (v.includes("car") && !v.includes("ic card")))
  ) {
    return true;
  }
  return false;
}

/** IC / Suica / PASMO top-ups (trip-wide — include in procurement). */
export function matchesIcCardHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  return (
    v.includes("suica") ||
    v.includes("pasmo") ||
    v.includes("icoca") ||
    v.includes("welcome suica") ||
    v.includes("ic card") ||
    v.includes("ic-card") ||
    v.includes("iccard") ||
    /\bic[\s-]?card\b/.test(v) ||
    v.includes("ic top") ||
    v.includes("ic top-up") ||
    v.includes("ic topup") ||
    (v.includes("top-up") &&
      (v.includes("ic") || v.includes("suica") || v.includes("pasmo"))) ||
    (v.includes("topup") &&
      (v.includes("ic") || v.includes("suica") || v.includes("pasmo"))) ||
    (v.includes("preload") &&
      (v.includes("ic") || v.includes("suica") || v.includes("pasmo"))) ||
    (v.includes("pre-load") &&
      (v.includes("ic") || v.includes("suica") || v.includes("pasmo"))) ||
    (v.includes("preloaded") &&
      (v.includes("ic") || v.includes("suica") || v.includes("pasmo")))
  );
}

/** Rail / local transit passes (Nikko, JR, Shinkansen…). */
export function matchesRailPassHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  return (
    v.includes("jr pass") ||
    v.includes("japan rail pass") ||
    v.includes("japan rail") ||
    v.includes("rail pass") ||
    v.includes("shinkansen") ||
    v.includes("bullet train") ||
    v.includes("train ticket") ||
    v.includes("metro pass") ||
    v.includes("subway pass") ||
    v.includes("transit pass") ||
    v.includes("local rail") ||
    v.includes("local transit") ||
    v.includes("kansai thru") ||
    v.includes("tokyo metro") ||
    v.includes("romancecar") ||
    v.includes("fuji excursion") ||
    v.includes("hakone free") ||
    v.includes("tobu") ||
    /\bnikko\b/.test(v) ||
    /\bkamakura\b/.test(v) ||
    /\bhakone\b/.test(v) ||
    (/\brail\b/.test(v) &&
      !v.includes("railroad museum")) ||
    (v.includes("pass") &&
      (v.includes("train") ||
        v.includes("metro") ||
        v.includes("transit") ||
        v.includes("jr") ||
        v.includes("rail") ||
        v.includes("nikko") ||
        v.includes("tobu") ||
        v.includes("hakone") ||
        v.includes("kamakura")))
  );
}

/** 3rd-party attractions / entry (TeamLab, Sumo, museums, parks…). */
export function matchesAttractionHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  return (
    v.includes("teamlab") ||
    v.includes("team lab") ||
    /\bsumo\b/.test(v) ||
    v.includes("museum") ||
    v.includes("theme park") ||
    v.includes("disney") ||
    v.includes("universal studios") ||
    v.includes("universal japan") ||
    v.includes("ghibli") ||
    v.includes("skytree") ||
    v.includes("tokyo tower") ||
    v.includes("shibuya sky") ||
    v.includes("aquarium") ||
    v.includes("zoo entry") ||
    v.includes("timed entry") ||
    v.includes("skip the line") ||
    v.includes("skip-the-line") ||
    v.includes("attraction") ||
    v.includes("entry ticket") ||
    v.includes("admission") ||
    (/\bentry\b/.test(v) &&
      (v.includes("ticket") ||
        v.includes("pass") ||
        v.includes("museum") ||
        v.includes("park") ||
        v.includes("show")))
  );
}

export function matchesHotelHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  return (
    v.includes("hotel") ||
    v.includes("ryokan") ||
    v.includes("accommodation") ||
    v.includes("lodging") ||
    v.includes("minshuku") ||
    v.includes("hostel") ||
    v.includes("airbnb") ||
    (v.includes("night") &&
      (v.includes("stay") || v.includes("room"))) ||
    (v.includes("stay") &&
      (v.includes("night") ||
        v.includes("room") ||
        v.includes("hotel") ||
        v.includes("check-in") ||
        v.includes("check in")))
  );
}

export function matchesGeneralTicketHaystack(hay: string): boolean {
  const v = String(hay || "").toLowerCase();
  if (!v) return false;
  return (
    /\bticket(s)?\b/.test(v) ||
    v.includes("voucher") ||
    v.includes("museum pass") ||
    /\bentry\b/.test(v)
  );
}

/**
 * Any ticket-like procurement line (IC / rail / attraction / general).
 * Excludes private vehicles; hotels are separate.
 */
export function matchesTicketProcurementHaystack(
  hay: string,
  category?: string | null
): boolean {
  const v = String(hay || "").toLowerCase();
  const cat = String(category || "").toUpperCase();

  if (isPrivateVehicleHaystack(v)) return false;

  if (
    matchesIcCardHaystack(v) ||
    matchesRailPassHaystack(v) ||
    matchesAttractionHaystack(v) ||
    matchesGeneralTicketHaystack(v)
  ) {
    return true;
  }

  if (cat === "TICKET") return true;

  // TRANSPORT catalog often holds Suica / rail / Nikko lines
  if (cat === "TRANSPORT" || cat === "TRANSIT") {
    return (
      matchesIcCardHaystack(v) ||
      v.includes("pass") ||
      v.includes("ticket") ||
      /\brail\b/.test(v) ||
      v.includes("shinkansen") ||
      v.includes("metro") ||
      v.includes("local transit") ||
      v.includes("transit pass") ||
      /\bnikko\b/.test(v) ||
      v.includes("tobu") ||
      v.includes("ferry") ||
      v.includes("bullet train") ||
      v.includes("train ticket")
    );
  }

  if (cat === "CONCIERGE_EXTRA" || cat === "EXTRA") {
    return (
      v.includes("pass") ||
      v.includes("entry") ||
      v.includes("ticket") ||
      v.includes("admission") ||
      v.includes("suica") ||
      v.includes("pasmo") ||
      v.includes("voucher") ||
      /\brail\b/.test(v) ||
      matchesAttractionHaystack(v)
    );
  }

  return false;
}

export function matchesHotelProcurementHaystack(
  hay: string,
  category?: string | null
): boolean {
  const v = String(hay || "").toLowerCase();
  const cat = String(category || "").toUpperCase();
  if (isPrivateVehicleHaystack(v)) return false;
  // Ticket keywords win over hotel when both appear
  if (matchesTicketProcurementHaystack(v, cat) && !matchesHotelHaystack(v)) {
    return false;
  }
  if (matchesHotelHaystack(v)) return true;
  if (cat === "CONCIERGE_EXTRA" || cat === "EXTRA" || cat === "HOTEL") {
    return (
      v.includes("stay") ||
      (v.includes("room") && !v.includes("tea room"))
    );
  }
  return false;
}

export function classifyProcurementCategory(input: {
  title?: string | null;
  notes?: string | null;
  category?: string | null;
  accessType?: string | null;
  type?: string | null;
}): ProcurementTicketCategory {
  const hay = procurementHaystack(
    input.title,
    input.notes,
    input.accessType,
    input.type,
    input.category
  );
  const cat = String(input.category || "").toUpperCase();

  if (
    matchesHotelProcurementHaystack(hay, cat) &&
    !matchesIcCardHaystack(hay) &&
    !matchesRailPassHaystack(hay) &&
    !(
      matchesAttractionHaystack(hay) ||
      matchesGeneralTicketHaystack(hay) ||
      cat === "TICKET"
    )
  ) {
    return "HOTEL";
  }

  if (matchesIcCardHaystack(hay)) return "IC_CARD";
  if (matchesRailPassHaystack(hay)) return "RAIL_PASS";
  if (matchesAttractionHaystack(hay)) return "ATTRACTION";
  if (matchesHotelHaystack(hay) && !matchesTicketProcurementHaystack(hay, cat)) {
    return "HOTEL";
  }
  return "GENERAL_TICKET";
}

export function procurementKindFromCategory(
  cat: ProcurementTicketCategory
): ProcurementKind {
  if (cat === "HOTEL") return "hotel";
  if (cat === "IC_CARD" || cat === "RAIL_PASS") return "transit";
  return "ticket";
}

/** Active cart line that belongs on the ticketer procurement checklist. */
export function isProcurementLineItem(item: ServiceLineItem): boolean {
  if (String(item.status || "").toUpperCase() === "DECLINED") return false;

  const hay = procurementHaystack(item.title, item.notes, item.category);
  const cat = String(item.category || "");

  if (isPrivateVehicleHaystack(hay)) return false;

  if (matchesTicketProcurementHaystack(hay, cat)) return true;
  if (matchesHotelProcurementHaystack(hay, cat)) return true;

  // Guide-only TOUR lines stay out unless they are clearly entry tickets
  if (String(item.category || "").toUpperCase() === "TOUR") {
    return (
      matchesAttractionHaystack(hay) ||
      /\bticket(s)?\b/.test(hay) ||
      hay.includes("admission") ||
      hay.includes("entry ticket")
    );
  }

  return false;
}

function normTitleKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rollupId(line: AccessRollupLine, index: number): string {
  const raw =
    String(line.id || line.tourId || "").trim() ||
    `rollup-${index}-${normTitleKey(line.title || line.name || "ticket")}`;
  return raw.startsWith("rollup:") || raw.startsWith("day:")
    ? raw
    : `rollup:${raw}`;
}

function dayTicketId(line: DayTicketLine, index: number): string {
  const raw =
    String(line.id || "").trim() ||
    `day-${index}-${normTitleKey(line.title || "ticket")}-${String(line.date || line.serviceDate || "").slice(0, 10)}`;
  return raw.startsWith("day:") ? raw : `day:${raw}`;
}

function fromCartItem(item: ServiceLineItem): NormalizedProcurementItem {
  const category = classifyProcurementCategory({
    title: item.title,
    notes: item.notes,
    category: item.category,
  });
  return {
    id: item.id,
    title: item.title,
    notes: String(item.notes || "").trim() || null,
    category,
    categoryLabel: procurementCategoryLabel(category),
    kind: procurementKindFromCategory(category),
    source: "agent_services",
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    isBonus: Boolean(item.isBonus),
    serviceDate: String(item.serviceDate || "").slice(0, 10) || null,
    scheduledDate: String(item.scheduledDate || "").slice(0, 10) || null,
    voucherUrl: String(item.voucherUrl || "").trim() || null,
    voucherFilename: String(item.voucherFilename || "").trim() || null,
    voucherBlobPathname: String(item.voucherBlobPathname || "").trim() || null,
    fulfillmentStatus: item.fulfillmentStatus || null,
    cartItem: item,
    uploadable: true,
  };
}

function fromRollupLine(
  line: AccessRollupLine,
  index: number
): NormalizedProcurementItem | null {
  const title = String(line.title || line.name || "").trim();
  if (!title) return null;
  const hay = procurementHaystack(
    title,
    line.label,
    line.accessType,
    line.type
  );
  // Rollup lines are already ticket/access rows — include unless private vehicle
  if (isPrivateVehicleHaystack(hay)) return null;
  const category = classifyProcurementCategory({
    title,
    notes: line.label,
    accessType: line.accessType,
    type: line.type,
  });
  return {
    id: rollupId(line, index),
    title,
    notes: String(line.label || line.type || "").trim() || null,
    category,
    categoryLabel: procurementCategoryLabel(category),
    kind: procurementKindFromCategory(category),
    source: "access_rollup",
    quantity: Math.max(
      1,
      Math.round(Number(line.quantity ?? line.qty) || 1)
    ),
    isBonus: false,
    serviceDate:
      String(line.serviceDate || line.date || "").slice(0, 10) || null,
    scheduledDate: null,
    voucherUrl: null,
    voucherFilename: null,
    voucherBlobPathname: null,
    fulfillmentStatus: null,
    cartItem: null,
    uploadable: false,
  };
}

function fromDayTicket(
  line: DayTicketLine,
  index: number
): NormalizedProcurementItem | null {
  const title = String(line.title || "").trim();
  if (!title) return null;
  const hay = procurementHaystack(title, line.type);
  if (isPrivateVehicleHaystack(hay)) return null;
  const category = classifyProcurementCategory({
    title,
    type: line.type,
  });
  return {
    id: dayTicketId(line, index),
    title,
    notes: String(line.type || "").trim() || null,
    category,
    categoryLabel: procurementCategoryLabel(category),
    kind: procurementKindFromCategory(category),
    source: "day_ticket",
    quantity: 1,
    isBonus: false,
    serviceDate:
      String(line.serviceDate || line.date || "").slice(0, 10) || null,
    scheduledDate: null,
    voucherUrl: null,
    voucherFilename: null,
    voucherBlobPathname: null,
    fulfillmentStatus: null,
    cartItem: null,
    uploadable: false,
  };
}

/**
 * Read optional rollup arrays from ops_hub.extras (forward-compatible keys).
 */
export function accessRollupFromExtras(extras: unknown): AccessRollupLine[] {
  if (!extras || typeof extras !== "object") return [];
  const obj = extras as Record<string, unknown>;
  const keys = [
    "ticket_access_rollup",
    "access_rollup",
    "ticketAccessRollup",
    "accessLines",
  ] as const;
  for (const key of keys) {
    const raw = obj[key];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(
        (row): row is AccessRollupLine =>
          Boolean(row) && typeof row === "object"
      ) as AccessRollupLine[];
    }
  }
  return [];
}

/** Day-ticket arrays nested on extras (if Ops persists them). */
export function dayTicketsFromExtras(extras: unknown): DayTicketLine[] {
  if (!extras || typeof extras !== "object") return [];
  const obj = extras as Record<string, unknown>;
  const keys = ["day_tickets", "itinerary_day_tickets", "dayTickets"] as const;
  const out: DayTicketLine[] = [];
  for (const key of keys) {
    const raw = obj[key];
    if (!Array.isArray(raw)) continue;
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      out.push(row as DayTicketLine);
    }
  }
  // Nested itinerary_days[].tickets
  const days = obj.itinerary_days || obj.itineraryDays;
  if (Array.isArray(days)) {
    for (const day of days) {
      if (!day || typeof day !== "object") continue;
      const d = day as Record<string, unknown>;
      const tickets = d.tickets;
      const date = String(d.date || "").slice(0, 10) || null;
      if (!Array.isArray(tickets)) continue;
      for (const t of tickets) {
        if (!t || typeof t !== "object") continue;
        const row = t as DayTicketLine;
        out.push({
          ...row,
          date: row.date || row.serviceDate || date,
        });
      }
    }
  }
  return out;
}

/**
 * Unified extractor — cart first, then rollup / day tickets for gaps.
 * Dedupes by cart id, then by normalized title (cart wins).
 */
export function extractProcurementItems(opts: {
  agentServices?: ServiceLineItem[] | null;
  accessRollup?: AccessRollupLine[] | null;
  dayTickets?: DayTicketLine[] | null;
  /** Raw extras — auto-reads ticket_access_rollup / day tickets when set. */
  extras?: unknown;
}): NormalizedProcurementItem[] {
  const cart = (opts.agentServices || []).filter(isProcurementLineItem);
  const rollup = [
    ...(opts.accessRollup || []),
    ...accessRollupFromExtras(opts.extras),
  ];
  const days = [
    ...(opts.dayTickets || []),
    ...dayTicketsFromExtras(opts.extras),
  ];

  const out: NormalizedProcurementItem[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  const push = (row: NormalizedProcurementItem | null) => {
    if (!row) return;
    if (seenIds.has(row.id)) return;
    const tk = normTitleKey(row.title);
    if (tk && seenTitles.has(tk)) return;
    seenIds.add(row.id);
    if (tk) seenTitles.add(tk);
    out.push(row);
  };

  for (const item of cart) push(fromCartItem(item));
  rollup.forEach((line, i) => push(fromRollupLine(line, i)));
  days.forEach((line, i) => push(fromDayTicket(line, i)));

  return out;
}

/** Cart-only ServiceLineItems for upload / payment-lock math. */
export function extractProcurementCartItems(
  agentServices: ServiceLineItem[] | null | undefined
): ServiceLineItem[] {
  return (agentServices || []).filter(isProcurementLineItem);
}
