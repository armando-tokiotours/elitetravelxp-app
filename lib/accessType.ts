/**
 * Tour access_type helpers — ticketer demand + purchase mode labels.
 *
 * Ticket = buy before (timed entry / vouchers)
 * Admission = pay on-site at the door
 * VIP Exclusive / Time-Sensitive = also need Ops/ticketer attention
 */

export type AccessTypeId =
  | "guided_route"
  | "direct_ticket"
  | "admission"
  | "vip_event"
  | "time_sensitive";

export type TicketPurchaseMode =
  | "pre_purchase"
  | "on_site"
  | "vip"
  | "timed"
  | "none";

/** Values that require ticketer / Ops ticket desk. */
export const TICKET_ACCESS_TYPES = new Set<string>([
  "direct_ticket",
  "admission",
  "vip_event",
  "time_sensitive",
]);

export function normalizeAccessTypeId(raw: unknown): AccessTypeId | null {
  const v = String(raw || "")
    .toLowerCase()
    .trim();
  if (v === "ticket") return "direct_ticket";
  if (
    v === "guided_route" ||
    v === "direct_ticket" ||
    v === "admission" ||
    v === "vip_event" ||
    v === "time_sensitive"
  ) {
    return v;
  }
  return null;
}

export function accessTypeNeedsTicketer(accessType?: string | null): boolean {
  const id = normalizeAccessTypeId(accessType);
  return id ? TICKET_ACCESS_TYPES.has(id) : false;
}

export function accessTypePurchaseMode(
  accessType?: string | null
): TicketPurchaseMode {
  const id = normalizeAccessTypeId(accessType);
  switch (id) {
    case "direct_ticket":
      return "pre_purchase";
    case "admission":
      return "on_site";
    case "vip_event":
      return "vip";
    case "time_sensitive":
      return "timed";
    default:
      return "none";
  }
}

export function accessTypeStaffLabel(accessType?: string | null): string {
  const id = normalizeAccessTypeId(accessType);
  switch (id) {
    case "direct_ticket":
      return "Ticket (buy before)";
    case "admission":
      return "Admission (buy on-site)";
    case "vip_event":
      return "VIP Exclusive";
    case "time_sensitive":
      return "Time-Sensitive Event";
    case "guided_route":
      return "Guided route";
    default:
      return "—";
  }
}

export function accessTypeGuestBadge(accessType?: string | null): string {
  const id = normalizeAccessTypeId(accessType);
  switch (id) {
    case "direct_ticket":
      return "Ticket";
    case "admission":
      return "Admission";
    case "vip_event":
      return "VIP";
    case "time_sensitive":
      return "Timed entry";
    default:
      return "Ticket";
  }
}

export type ExperienceAccessTicketLine = {
  tourId?: string;
  name: string;
  qty?: number;
  accessType?: string;
  purchaseMode?: TicketPurchaseMode;
};

/**
 * Detect entry-ticket experiences (teamLab, Ticket, Admission, timed entry…).
 */
export function experienceNeedsEntryTicket(input: {
  title?: string | null;
  description?: string | null;
  access_type?: string | null;
  is_self_guided?: boolean | null;
  category?: string | null;
}): boolean {
  if (accessTypeNeedsTicketer(input.access_type)) return true;
  if (input.is_self_guided) return true;
  const hay = `${input.title || ""} ${input.description || ""}`.toLowerCase();
  if (
    hay.includes("teamlab") ||
    hay.includes("team lab") ||
    hay.includes("ghibli") ||
    hay.includes("disney") ||
    hay.includes("universal") ||
    hay.includes("shibuya sky") ||
    hay.includes("skytree") ||
    hay.includes("tokyo tower") ||
    hay.includes("go-kart") ||
    hay.includes("gokart") ||
    hay.includes("timed entry") ||
    hay.includes("admission") ||
    hay.includes("skip the line") ||
    hay.includes("vip")
  ) {
    return true;
  }
  return false;
}
