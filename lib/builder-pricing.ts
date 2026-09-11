import type { BuilderConfig, SystemRulesMap } from "@/lib/pocketbase/client";
import {
  hotelMax,
  hotelMin,
  ruleBool,
  ruleNumber,
  tourPrice,
  transferDropoff,
  transferPickup,
} from "@/lib/pocketbase/client";
import type { BuilderState } from "@/store/useBuilderStore";

export interface QuoteResult {
  min: number;
  max: number;
  vehiclesNeeded: string;
}

export function allocateVehicles(
  guestCount: number,
  vehicles: BuilderConfig["vehicles"],
  rules: SystemRulesMap = {}
): { label: string; dailyCost: number } {
  if (guestCount <= 0 || vehicles.length === 0) {
    return { label: "No vehicle", dailyCost: 0 };
  }

  const threshold = ruleNumber(rules, "second_vehicle_guest_threshold", 3);
  const sorted = [...vehicles].sort(
    (a, b) => a.max_passengers - b.max_passengers
  );
  const labelOf = (v: (typeof vehicles)[0]) => v.name || v.type || "Vehicle";

  if (guestCount > threshold) {
    const fit = sorted.find((v) => v.max_passengers >= guestCount);
    if (fit) {
      return { label: `1 × ${labelOf(fit)}`, dailyCost: fit.price_per_day };
    }
    const small = sorted[0];
    const count = Math.max(2, Math.ceil(guestCount / small.max_passengers));
    return {
      label: `${count} × ${labelOf(small)}`,
      dailyCost: small.price_per_day * count,
    };
  }

  const fit = sorted.find((v) => v.max_passengers >= guestCount) ?? sorted[0];
  return {
    label: `1 × ${labelOf(fit)}`,
    dailyCost: fit.price_per_day,
  };
}

export function calculateBuilderQuote(
  state: BuilderState,
  config: BuilderConfig
): QuoteResult {
  const rules = config.rules ?? {};
  let min = 600;
  let max = 1000;

  const nights = state.locations.reduce((s, l) => s + l.nights, 0);
  const guests = state.adults + state.children;

  const seasonalPct = ruleNumber(rules, "seasonal_markup_percentage", 0);
  const seasonalFromPct = 1 + seasonalPct / 100;
  const pricingMult =
    ruleNumber(rules, "pricing_multiplier", 1) *
    (rules.seasonal_markup_percentage != null
      ? seasonalFromPct
      : ruleNumber(rules, "seasonal_multiplier", 1));

  if (state.needHotels && nights > 0) {
    const matches = config.accommodations.filter(
      (a) =>
        a.tier === state.hotelTier &&
        a.room_type.toLowerCase() === state.roomType.toLowerCase()
    );
    const row =
      matches[0] ||
      config.accommodations.find((a) => a.tier === state.hotelTier);
    if (row) {
      min += hotelMin(row) * state.roomCount * nights;
      max += hotelMax(row) * state.roomCount * nights;
    }
  }

  const arrival = config.transfers.find(
    (t) => t.id === state.arrivalTransferId
  );
  const departure = config.transfers.find(
    (t) => t.id === state.departureTransferId
  );
  if (state.airportPickup && arrival) {
    const fee = transferPickup(arrival);
    min += fee;
    max += fee * 1.15;
  }
  if (state.airportDropoff && departure) {
    const fee = transferDropoff(departure);
    min += fee;
    max += fee * 1.15;
  }

  const legs = Math.max(0, state.locations.length - 1);
  const transit = config.transitModes.find(
    (t) => t.id === state.transitModeId
  );
  if (legs > 0 && transit) {
    min += transit.price_per_leg * legs * Math.max(1, guests);
    max += transit.price_per_leg * 1.25 * legs * Math.max(1, guests);
  }

  for (const id of state.selectedTourIds) {
    const tour = config.tours.find((t) => t.id === id);
    if (tour) {
      const p = tourPrice(tour) * Math.max(1, guests);
      min += p;
      max += p * 1.15;
    }
  }

  const veh = allocateVehicles(guests, config.vehicles, rules);
  if (state.needDriver) {
    const allowOnTravel = ruleBool(rules, "allow_tours_on_travel_days", false);
    const days = allowOnTravel
      ? state.durationDays
      : Math.max(1, state.durationDays - legs);
    min += veh.dailyCost * days;
    max += veh.dailyCost * 1.2 * days;
  }

  return {
    min: Math.round(min * pricingMult),
    max: Math.round(max * pricingMult),
    vehiclesNeeded: veh.label,
  };
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Suggested rooms from max_occupancy rules */
export function suggestedRooms(
  guests: number,
  occupancy: number,
  maxAdultsPerRoom: number
): number {
  const perRoom = Math.max(1, Math.min(occupancy || 2, maxAdultsPerRoom || 3));
  return Math.max(1, Math.ceil(guests / perRoom));
}
