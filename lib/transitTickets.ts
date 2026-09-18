import type { CityTransitType } from "@/store/useBuilderStore";

export type TransitTicketType = "ic_card" | "shinkansen_reserved" | "none";

export type TransitTicketKind = "ic_card" | "shinkansen_reserved";

export type TransitLegTicketChoice = {
  mode: CityTransitType;
  needsTicket: boolean;
  ticketType: TransitTicketType;
  /** Estimated € per passenger when needsTicket */
  ticketPricePerPax: number;
};

/** IC / airport express (Suica-Pasmo style). */
export const IC_CARD_PRICE = { min: 20, max: 35, est: 28 } as const;

/** Reserved Shinkansen seat between cities. */
export const SHINKANSEN_PRICE = { min: 90, max: 140, est: 115 } as const;

/**
 * Intra-city / airport express → IC card.
 * Inter-city city→city → reserved Shinkansen.
 */
export function detectTransitTicketKind(opts: {
  fromCityId?: string;
  toCityId?: string;
  toIsHub?: boolean;
}): TransitTicketKind {
  if (opts.toIsHub) return "ic_card";
  if (!opts.fromCityId || !opts.toCityId) return "ic_card";
  if (opts.fromCityId === opts.toCityId) return "ic_card";
  return "shinkansen_reserved";
}

export function ticketPriceBand(kind: TransitTicketKind) {
  return kind === "ic_card" ? IC_CARD_PRICE : SHINKANSEN_PRICE;
}

export function ticketOptionLabel(kind: TransitTicketKind): string {
  return kind === "ic_card"
    ? "Physical Suica/Pasmo Card with pre-loaded balance"
    : "Reserved Shinkansen Seat Ticket";
}

export function ticketTypeLabel(type: TransitTicketType): string {
  switch (type) {
    case "ic_card":
      return "Suica/Pasmo IC card (pre-loaded)";
    case "shinkansen_reserved":
      return "Reserved Shinkansen seat";
    default:
      return "Self-purchased tickets";
  }
}

export function buildTransitTicketChoice(
  mode: CityTransitType,
  needsTicket: boolean,
  kind: TransitTicketKind
): TransitLegTicketChoice {
  const resolved = mode === "unset" ? "self" : mode;
  if (resolved !== "public" || !needsTicket) {
    return {
      mode: resolved === "public" ? "public" : resolved,
      needsTicket: false,
      ticketType: "none",
      ticketPricePerPax: 0,
    };
  }
  return {
    mode: "public",
    needsTicket: true,
    ticketType: kind,
    ticketPricePerPax: ticketPriceBand(kind).est,
  };
}

/** Sum pre-booked ticket costs across arrival + city legs. */
export function sumTransitTicketCosts(opts: {
  guests: number;
  arrivalTransitType: CityTransitType;
  arrivalNeedsTicket?: boolean;
  arrivalTicketPricePerPax?: number;
  locations: Array<{
    transitType: CityTransitType;
    needsTicket?: boolean;
    ticketPricePerPax?: number;
  }>;
}): number {
  const g = Math.max(1, opts.guests);
  let total = 0;
  if (
    opts.arrivalTransitType === "public" &&
    opts.arrivalNeedsTicket &&
    (opts.arrivalTicketPricePerPax ?? 0) > 0
  ) {
    total += (opts.arrivalTicketPricePerPax ?? 0) * g;
  }
  for (const loc of opts.locations) {
    if (
      loc.transitType === "public" &&
      loc.needsTicket &&
      (loc.ticketPricePerPax ?? 0) > 0
    ) {
      total += (loc.ticketPricePerPax ?? 0) * g;
    }
  }
  return Math.round(total);
}
