import type { BuilderConfig, SystemRulesMap } from "@/lib/pocketbase/client";
import { ruleBool, ruleNumber } from "@/lib/pocketbase/client";
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

  // If over threshold, prefer enough capacity / second vehicle
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
  const pricingMult =
    ruleNumber(rules, "pricing_multiplier", 1) *
    ruleNumber(rules, "seasonal_multiplier", 1);

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
      min += row.min_price * state.roomCount * nights;
      max += row.max_price * state.roomCount * nights;
    }
  }

  for (const loc of state.locations) {
    const city = config.cities.find((c) => c.id === loc.cityId);
    if (!city) continue;
    if (city.base_price) {
      min += city.base_price * loc.nights * 0.9;
      max += city.base_price * loc.nights * 1.15;
    } else if (city.base_price_modifier) {
      const uplift = (city.base_price_modifier - 1) * 200 * loc.nights;
      min += Math.max(0, uplift * 0.8);
      max += Math.max(0, uplift * 1.2);
    }
  }

  const arrival = config.transfers.find(
    (t) => t.id === state.arrivalTransferId
  );
  const departure = config.transfers.find(
    (t) => t.id === state.departureTransferId
  );
  if (state.airportPickup && arrival) {
    min += arrival.pickup_fee;
    max += arrival.pickup_fee * 1.15;
  }
  if (state.airportDropoff && departure) {
    min += departure.dropoff_fee;
    max += departure.dropoff_fee * 1.15;
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
      min += tour.price;
      max += tour.price * 1.2;
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

  min = Math.round(min * pricingMult);
  max = Math.round(max * pricingMult);

  return {
    min,
    max,
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
