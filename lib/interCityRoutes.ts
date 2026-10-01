/**
 * Inter-city transport engine — lookup + pricing over PocketBase `city_movements`
 * (admin label: Inter-City Routes) and optional linked `transport_products`.
 */

import type { PbCity, PbCityMovement } from "@/lib/pocketbase/client";
import type {
  CityTransitType,
  LocationStop,
  TravelPace,
} from "@/store/useBuilderStore";
import type { TransportTicketLine } from "@/lib/transportProducts";

/** ~Tokyo→Kyoto class: prefer rail when pace is Fast. */
const LONG_HAUL_PUBLIC_MINS = 90;

/**
 * Suggest transport mode from Travel Pace, route length, party size, and mobility.
 * Guests > 4 or reduced_mobility → Private · Relaxed → Private · Fast long-haul → Public.
 */
export function suggestTransitForLeg(opts: {
  travelPace: TravelPace;
  publicMins: number | null;
  allowPrivate: boolean;
  guests?: number;
  hasMobilityNeeds?: boolean;
}): Exclude<CityTransitType, "unset"> {
  if (opts.hasMobilityNeeds && opts.allowPrivate) return "private";
  if ((opts.guests ?? 0) > 4 && opts.allowPrivate) return "private";

  const longHaul = (opts.publicMins ?? 0) >= LONG_HAUL_PUBLIC_MINS;
  if (opts.travelPace === "relaxed" && opts.allowPrivate) return "private";
  if (opts.travelPace === "fast") {
    if (longHaul) return "public";
    return opts.allowPrivate ? "private" : "public";
  }
  if (opts.travelPace === "moderate") {
    return longHaul ? "public" : opts.allowPrivate ? "private" : "public";
  }
  return longHaul ? "public" : "self";
}

export type SelfArrangeCityRates = {
  /** Typical taxi / Uber hop within the city (€). */
  avgTaxiEur: number;
  /** Typical subway / day-pass spend (€). */
  avgSubwayDayEur: number;
  /** Typical wait / transfer friction (minutes). */
  taxiWaitMins: number;
};

export const DEFAULT_SELF_ARRANGE_RATES: SelfArrangeCityRates = {
  avgTaxiEur: 28,
  avgSubwayDayEur: 9,
  taxiWaitMins: 12,
};

export function citySelfArrangeRates(
  city?: Pick<
    PbCity,
    "avg_taxi_eur" | "avg_subway_day_eur" | "taxi_wait_mins"
  > | null
): SelfArrangeCityRates {
  return {
    avgTaxiEur:
      city?.avg_taxi_eur != null && Number(city.avg_taxi_eur) > 0
        ? Number(city.avg_taxi_eur)
        : DEFAULT_SELF_ARRANGE_RATES.avgTaxiEur,
    avgSubwayDayEur:
      city?.avg_subway_day_eur != null && Number(city.avg_subway_day_eur) > 0
        ? Number(city.avg_subway_day_eur)
        : DEFAULT_SELF_ARRANGE_RATES.avgSubwayDayEur,
    taxiWaitMins:
      city?.taxi_wait_mins != null && Number(city.taxi_wait_mins) > 0
        ? Number(city.taxi_wait_mins)
        : DEFAULT_SELF_ARRANGE_RATES.taxiWaitMins,
  };
}

/** Find a movement; prefer exact from→to, then reverse as fallback. */
export function findCityMovement(
  movements: PbCityMovement[] | undefined,
  fromCityId: string,
  toCityId: string
): PbCityMovement | null {
  if (!movements?.length || !fromCityId || !toCityId) return null;
  const forward = movements.find(
    (m) => m.from_city_id === fromCityId && m.to_city_id === toCityId
  );
  if (forward) return forward;
  return (
    movements.find(
      (m) => m.from_city_id === toCityId && m.to_city_id === fromCityId
    ) ?? null
  );
}

export function movementTimeMins(
  movement: PbCityMovement | null | undefined,
  mode: "public" | "private"
): number | null {
  if (!movement) return null;
  const n =
    mode === "private"
      ? Number(movement.private_transit_time_mins)
      : Number(movement.public_transit_time_mins);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Cost for one inter-city leg.
 * - public: `public_transit_cost` is treated as **per person** (× guests)
 * - private: `private_transit_cost` is treated as **vehicle total** (not × guests)
 */
export function movementLegCostEur(
  movement: PbCityMovement | null | undefined,
  mode: "public" | "private",
  guests: number
): number {
  if (!movement) return 0;
  const g = Math.max(1, guests);
  if (mode === "private") {
    return Math.max(0, Number(movement.private_transit_cost) || 0);
  }
  return Math.max(0, Number(movement.public_transit_cost) || 0) * g;
}

export type InterCityLegQuote = {
  fromCityId: string;
  toCityId: string;
  fromKey: string;
  mode: CityTransitType;
  publicMins: number | null;
  privateMins: number | null;
  publicCostEur: number;
  privateCostEur: number;
  invoiceEur: number;
  linkedProductId?: string;
};

/** Stay cities only — transit on stop i = travel toward stop i+1. */
export function buildInterCityLegQuotes(opts: {
  locations: LocationStop[];
  movements: PbCityMovement[] | undefined;
  guests: number;
}): InterCityLegQuote[] {
  const stays = opts.locations.filter(
    (l) =>
      (!l.visitType || l.visitType === "stay") &&
      (l.nights || 0) > 0 &&
      l.cityId
  );
  const out: InterCityLegQuote[] = [];
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];
    const movement = findCityMovement(
      opts.movements,
      from.cityId,
      to.cityId
    );
    const mode = (from.transitType || "unset") as CityTransitType;
    const publicCost = movementLegCostEur(movement, "public", opts.guests);
    const privateCost = movementLegCostEur(movement, "private", opts.guests);
    let invoiceEur = 0;
    if (mode === "public") invoiceEur = publicCost;
    else if (mode === "private") invoiceEur = privateCost;
    out.push({
      fromCityId: from.cityId,
      toCityId: to.cityId,
      fromKey: from.key,
      mode,
      publicMins: movementTimeMins(movement, "public"),
      privateMins: movementTimeMins(movement, "private"),
      publicCostEur: publicCost,
      privateCostEur: privateCost,
      invoiceEur,
      linkedProductId: movement?.linked_transport_product_id || undefined,
    });
  }
  return out;
}

/** Trip-wide cost if every onward leg used the same mode. */
export function compareInterCityTripCosts(opts: {
  locations: LocationStop[];
  movements: PbCityMovement[] | undefined;
  guests: number;
}): {
  selfEur: number;
  publicEur: number;
  privateEur: number;
  legs: Array<{
    fromCityId: string;
    toCityId: string;
    publicEur: number;
    privateEur: number;
    publicMins: number | null;
    privateMins: number | null;
  }>;
} {
  const quotes = buildInterCityLegQuotes(opts);
  const legs = quotes.map((q) => ({
    fromCityId: q.fromCityId,
    toCityId: q.toCityId,
    publicEur: q.publicCostEur,
    privateEur: q.privateCostEur,
    publicMins: q.publicMins,
    privateMins: q.privateMins,
  }));
  return {
    selfEur: 0,
    publicEur: legs.reduce((s, l) => s + l.publicEur, 0),
    privateEur: legs.reduce((s, l) => s + l.privateEur, 0),
    legs,
  };
}

export function sumInterCityInvoiceEur(opts: {
  locations: LocationStop[];
  movements: PbCityMovement[] | undefined;
  guests: number;
}): number {
  return buildInterCityLegQuotes(opts).reduce((s, leg) => s + leg.invoiceEur, 0);
}

export function sumSelectedTransportProductEur(
  lines: TransportTicketLine[] | undefined,
  guests: number
): number {
  const g = Math.max(1, guests);
  let total = 0;
  for (const line of lines || []) {
    const qty = Math.max(1, Number(line.quantity) || g);
    total += Math.max(0, Number(line.pricePerPerson) || 0) * qty;
  }
  return total;
}

/** Estimate out-of-pocket local spend when Self-Arranged (not on invoice). */
export function estimateSelfArrangeDailyEur(
  city: Parameters<typeof citySelfArrangeRates>[0],
  nights: number
): { taxiEur: number; subwayEur: number; waitMins: number; totalEur: number } {
  const rates = citySelfArrangeRates(city);
  const days = Math.max(1, nights);
  const taxiEur = rates.avgTaxiEur * days;
  const subwayEur = rates.avgSubwayDayEur * days;
  return {
    taxiEur,
    subwayEur,
    waitMins: rates.taxiWaitMins,
    totalEur: taxiEur + subwayEur,
  };
}
