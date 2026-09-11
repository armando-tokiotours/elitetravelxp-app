import type { BuilderConfig } from "@/lib/pocketbase/client";
import type { BuilderState } from "@/store/useBuilderStore";

export interface QuoteResult {
  min: number;
  max: number;
  vehiclesNeeded: string;
}

export function allocateVehicles(
  guestCount: number,
  vehicles: BuilderConfig["vehicles"]
): { label: string; dailyCost: number } {
  if (guestCount <= 0 || vehicles.length === 0) {
    return { label: "No vehicle", dailyCost: 0 };
  }
  const sorted = [...vehicles].sort(
    (a, b) => a.max_passengers - b.max_passengers
  );
  const fit = sorted.find((v) => v.max_passengers >= guestCount);
  if (fit) {
    return {
      label: `1 × ${fit.type}`,
      dailyCost: fit.price_per_day,
    };
  }
  // Multiple largest vehicles
  const largest = sorted[sorted.length - 1];
  const count = Math.ceil(guestCount / largest.max_passengers);
  return {
    label: `${count} × ${largest.type}`,
    dailyCost: largest.price_per_day * count,
  };
}

export function calculateBuilderQuote(
  state: BuilderState,
  config: BuilderConfig
): QuoteResult {
  let min = 600;
  let max = 1000;

  const nights = state.locations.reduce((s, l) => s + l.nights, 0);
  const guests = state.adults + state.children;

  // Hotels
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

  // City modifiers (soft uplift)
  for (const loc of state.locations) {
    const city = config.cities.find((c) => c.id === loc.cityId);
    if (city) {
      const uplift = (city.base_price_modifier - 1) * 200 * loc.nights;
      min += Math.max(0, uplift * 0.8);
      max += Math.max(0, uplift * 1.2);
    }
  }

  // Transfers
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

  // Transit legs
  const legs = Math.max(0, state.locations.length - 1);
  const transit = config.transitModes.find(
    (t) => t.id === state.transitModeId
  );
  if (legs > 0 && transit) {
    min += transit.price_per_leg * legs * Math.max(1, guests);
    max += transit.price_per_leg * 1.25 * legs * Math.max(1, guests);
  }

  // Tours
  for (const id of state.selectedTourIds) {
    const tour = config.tours.find((t) => t.id === id);
    if (tour) {
      min += tour.price;
      max += tour.price * 1.2;
    }
  }

  // Driver
  const veh = allocateVehicles(guests, config.vehicles);
  if (state.needDriver) {
    const days = Math.max(1, state.durationDays - legs);
    min += veh.dailyCost * days;
    max += veh.dailyCost * 1.2 * days;
  }

  return {
    min: Math.round(min),
    max: Math.round(max),
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
