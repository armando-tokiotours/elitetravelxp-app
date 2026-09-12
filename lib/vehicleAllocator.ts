import type {
  PbAirportTransfer,
  PbChauffeurRate,
  PbVehicle,
} from "@/lib/pocketbase/client";
import { vehicleMaxPax, vehicleLabel } from "@/lib/pocketbase/client";

/** Client-facing markup on net transfer base fees */
export const TRANSFER_MARKUP = 1.3;

export interface FleetUnit {
  vehicle: PbVehicle;
  vehicle_id: string;
  count: number;
}

export interface FleetAllocation {
  units: FleetUnit[];
  /** Human-readable summary, e.g. "2 × 10-seater" */
  label: string;
  totalCapacity: number;
}

export interface TransferPriceQuote {
  min: number;
  max: number;
  fleet: FleetAllocation;
  /** True when rates came from airport_transfers rows */
  fromRates: boolean;
}

/** Capacity helper — prefers max_pax when present. */
export function capacityOf(v: PbVehicle): number {
  return vehicleMaxPax(v);
}

/**
 * Smart fleet allocation for airport transfers.
 *
 * 1. Prefer a single smallest vehicle that fits everyone.
 * 2. For oversized parties, use a homogeneous fleet of the same vehicle type
 *    (avoid awkward mixes like 14-seater + Alphard). Among options with the
 *    same vehicle count, pick the tightest-fitting (smallest) vehicle.
 */
export function allocateFleet(
  totalPax: number,
  vehicles: PbVehicle[]
): FleetAllocation {
  const pax = Math.max(0, Math.floor(totalPax));
  const usable = vehicles
    .filter((v) => capacityOf(v) > 0)
    .slice()
    .sort((a, b) => capacityOf(a) - capacityOf(b));

  if (pax <= 0 || usable.length === 0) {
    return { units: [], label: "No vehicle", totalCapacity: 0 };
  }

  // Single vehicle that fits
  const single = usable.find((v) => capacityOf(v) >= pax);
  if (single) {
    return {
      units: [{ vehicle: single, vehicle_id: single.id, count: 1 }],
      label: `1 × ${vehicleLabel(single)}`,
      totalCapacity: capacityOf(single),
    };
  }

  // Homogeneous fleets: minimize vehicle count, then prefer tightest fit
  type Candidate = { vehicle: PbVehicle; count: number };
  const candidates: Candidate[] = [];
  for (const v of usable) {
    const cap = capacityOf(v);
    const count = Math.ceil(pax / cap);
    if (count > 0 && count * cap >= pax) {
      candidates.push({ vehicle: v, count });
    }
  }

  if (candidates.length === 0) {
    const largest = usable[usable.length - 1];
    const count = Math.max(1, Math.ceil(pax / capacityOf(largest)));
    return {
      units: [{ vehicle: largest, vehicle_id: largest.id, count }],
      label: `${count} × ${vehicleLabel(largest)}`,
      totalCapacity: count * capacityOf(largest),
    };
  }

  const minCount = Math.min(...candidates.map((c) => c.count));
  const atMin = candidates.filter((c) => c.count === minCount);
  atMin.sort((a, b) => capacityOf(a.vehicle) - capacityOf(b.vehicle));
  const best = atMin[0];

  return {
    units: [
      {
        vehicle: best.vehicle,
        vehicle_id: best.vehicle.id,
        count: best.count,
      },
    ],
    label: `${best.count} × ${vehicleLabel(best.vehicle)}`,
    totalCapacity: best.count * capacityOf(best.vehicle),
  };
}

/** Resolve net base fee from a rate row (supports pre-migration field names). */
export function transferBaseFee(
  rate: PbAirportTransfer,
  direction: "pickup" | "dropoff"
): number {
  if (direction === "pickup") {
    return Number(
      rate.base_pickup_fee ?? rate.pickup_price_min ?? 0
    );
  }
  return Number(
    rate.base_dropoff_fee ?? rate.dropoff_price_min ?? 0
  );
}

export function priceWithMarkup(baseTotal: number): {
  min: number;
  max: number;
} {
  const min = Math.round(baseTotal);
  const max = Math.round(baseTotal * TRANSFER_MARKUP);
  return { min, max };
}

export function priceFleetTransfer(opts: {
  hubId: string;
  direction: "pickup" | "dropoff";
  totalPax: number;
  vehicles: PbVehicle[];
  rates: PbAirportTransfer[];
}): TransferPriceQuote | null {
  const { hubId, direction, totalPax, vehicles, rates } = opts;
  if (!hubId || totalPax <= 0) return null;

  const fleet = allocateFleet(totalPax, vehicles);
  if (fleet.units.length === 0) return null;

  let baseTotal = 0;
  let pricedUnits = 0;

  for (const unit of fleet.units) {
    const rate = rates.find(
      (r) => r.hub_id === hubId && r.vehicle_id === unit.vehicle_id
    );
    if (!rate) continue;
    const base = transferBaseFee(rate, direction);
    if (base <= 0) continue;
    baseTotal += base * unit.count;
    pricedUnits++;
  }

  if (pricedUnits === 0 || baseTotal <= 0) {
    return { min: 0, max: 0, fleet, fromRates: false };
  }

  const { min, max } = priceWithMarkup(baseTotal);
  return { min, max, fleet, fromRates: true };
}

/** Format a min/max transfer quote for UI. */
export function formatTransferPriceRange(min: number, max: number): string {
  const fmt = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;
  if (min <= 0 && max <= 0) return "";
  if (max <= min) return fmt(min);
  return `${fmt(min)}–${fmt(max)}`;
}

export function priceFleetChauffeurDay(opts: {
  cityId: string;
  totalPax: number;
  vehicles: PbVehicle[];
  rates: PbChauffeurRate[];
}): TransferPriceQuote | null {
  const { cityId, totalPax, vehicles, rates } = opts;
  if (!cityId || totalPax <= 0) return null;

  const fleet = allocateFleet(totalPax, vehicles);
  if (fleet.units.length === 0) return null;

  let baseTotal = 0;
  let pricedUnits = 0;

  for (const unit of fleet.units) {
    const rate = rates.find(
      (r) => r.city_id === cityId && r.vehicle_id === unit.vehicle_id
    );
    const base = Number(rate?.base_daily_rate ?? 0);
    if (!rate || base <= 0) continue;
    baseTotal += base * unit.count;
    pricedUnits++;
  }

  // Fallback: vehicle.price_per_day when city rates missing
  if (pricedUnits === 0) {
    for (const unit of fleet.units) {
      const daily = Number(unit.vehicle.price_per_day ?? 0);
      if (daily <= 0) continue;
      baseTotal += daily * unit.count;
      pricedUnits++;
    }
  }

  if (pricedUnits === 0 || baseTotal <= 0) {
    return { min: 0, max: 0, fleet, fromRates: false };
  }

  const { min, max } = priceWithMarkup(baseTotal);
  return { min, max, fleet, fromRates: true };
}
