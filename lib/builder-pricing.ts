import type { BuilderConfig, SystemRulesMap } from "@/lib/pocketbase/client";
import {
  hotelMax,
  hotelMin,
  hubDropoff,
  hubPickup,
  ruleBool,
  ruleNumber,
  tourPrice,
  transferDropoff,
  transferPickup,
} from "@/lib/pocketbase/client";
import type { BuilderState } from "@/store/useBuilderStore";
import { priceFleetTransfer, priceFleetChauffeurDay } from "@/lib/vehicleAllocator";
import { transferFeeForPax } from "@/lib/transferVehicle";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  chauffeurDaysFromSelections,
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";

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
    const monthName = state.arrivalDate
      ? new Date(
          Number(state.arrivalDate.slice(0, 4)),
          Number(state.arrivalDate.slice(5, 7)) - 1,
          1
        ).toLocaleString("en-US", { month: "long" })
      : null;

    for (const loc of state.locations) {
      const pref = state.cityHotels?.[loc.cityId];
      const needsHotel = pref ? pref.needsHotel : state.needHotels;
      if (!needsHotel || loc.nights < 1) continue;

      const star = pref ? `${pref.starRating}-star` : state.hotelTier;
      const room = pref?.roomType || state.roomType;
      const breakfast = pref
        ? pref.breakfast
          ? "Included"
          : "Not Included"
        : null;

      const scored = config.accommodations
        .map((a) => {
          let score = 0;
          const aStar = a.star_rating || a.tier;
          if (aStar === star) score += 4;
          if (
            (a.room_type || "").toLowerCase().includes(String(room).toLowerCase())
          )
            score += 3;
          if (a.city_id && a.city_id === loc.cityId) score += 5;
          if (breakfast && a.breakfast === breakfast) score += 2;
          if (monthName && a.month === monthName) score += 2;
          return { a, score };
        })
        .filter((x) => x.score >= 4)
        .sort((x, y) => y.score - x.score);

      const row =
        scored[0]?.a ||
        config.accommodations.find(
          (a) => (a.star_rating || a.tier) === star
        ) ||
        config.accommodations.find((a) => a.tier === state.hotelTier);

      if (row) {
        const rooms = Math.max(
          1,
          state.roomCount ||
            Math.ceil(Math.max(1, state.adults + state.children) / 2)
        );
        min += hotelMin(row) * rooms * loc.nights;
        max += hotelMax(row) * rooms * loc.nights;
      }
    }
  }

  const arrivalHub = config.hubs?.find((h) => h.id === state.arrivalTransferId);
  const departureHub = config.hubs?.find(
    (h) => h.id === state.departureTransferId
  );
  const arrivalTransfer = config.transfers.find(
    (t) => t.id === state.arrivalTransferId
  );
  const departureTransfer = config.transfers.find(
    (t) => t.id === state.departureTransferId
  );

  if (state.airportPickup) {
    const quote = arrivalHub
      ? priceFleetTransfer({
          hubId: arrivalHub.id,
          direction: "pickup",
          totalPax: guests,
          vehicles: config.vehicles,
          rates: config.airportTransfers ?? [],
        })
      : null;
    if (quote?.fromRates && quote.min > 0) {
      min += quote.min;
      max += quote.max;
    } else {
      const base = arrivalHub
        ? hubPickup(arrivalHub)
        : arrivalTransfer
          ? transferPickup(arrivalTransfer)
          : 0;
      const fee = transferFeeForPax(base, guests);
      min += fee;
      max += Math.round(fee * 1.3);
    }
  }
  if (state.airportDropoff) {
    const quote = departureHub
      ? priceFleetTransfer({
          hubId: departureHub.id,
          direction: "dropoff",
          totalPax: guests,
          vehicles: config.vehicles,
          rates: config.airportTransfers ?? [],
        })
      : null;
    if (quote?.fromRates && quote.min > 0) {
      min += quote.min;
      max += quote.max;
    } else {
      const base = departureHub
        ? hubDropoff(departureHub)
        : departureTransfer
          ? transferDropoff(departureTransfer)
          : 0;
      const fee = transferFeeForPax(base, guests);
      min += fee;
      max += Math.round(fee * 1.3);
    }
  }

  const legs = Math.max(0, state.locations.length - 1);
  if (legs > 0) {
    let transitMin = 0;
    let transitMax = 0;
    let pricedLegs = 0;
    for (let i = 0; i < state.locations.length - 1; i++) {
      const from = state.locations[i];
      const to = state.locations[i + 1];
      const movement = config.cityMovements?.find(
        (m) => m.from_city_id === from.cityId && m.to_city_id === to.cityId
      );
      const usePrivate = from.transitType === "private";
      if (movement) {
        const cost = Number(
          usePrivate
            ? movement.private_transit_cost ?? 0
            : movement.public_transit_cost ?? 0
        );
        transitMin += cost;
        transitMax += cost * 1.25;
        pricedLegs++;
      }
    }
    if (pricedLegs < legs) {
      const transit = config.transitModes.find(
        (t) => t.id === state.transitModeId
      );
      if (transit) {
        const remaining = legs - pricedLegs;
        transitMin += transit.price_per_leg * remaining * Math.max(1, guests);
        transitMax +=
          transit.price_per_leg * 1.25 * remaining * Math.max(1, guests);
      }
    }
    min += transitMin;
    max += transitMax;
  }

  for (const rows of Object.values(state.selectedTours ?? {})) {
    if (state.isEliteConcierge) break;
    for (const row of rows) {
      const p =
        (Number(row.price) || 0) > 0
          ? Number(row.price) * Math.max(1, guests)
          : (() => {
              const tour = config.tours.find((t) => t.id === row.tourId);
              return tour ? tourPrice(tour) * Math.max(1, guests) : 0;
            })();
      if (p > 0) {
        min += p;
        max += p * 1.15;
      }
    }
  }
  if (!state.selectedTours || Object.keys(state.selectedTours).length === 0) {
    for (const id of state.selectedTourIds) {
      if (state.isEliteConcierge) break;
      const tour = config.tours.find((t) => t.id === id);
      if (tour) {
        const p = tourPrice(tour) * Math.max(1, guests);
        min += p;
        max += p * 1.15;
      }
    }
  }

  if (state.isEliteConcierge) {
    const fee = ruleNumber(rules, "elite_concierge_fee", 2800);
    min += fee;
    max += fee * 1.2;
  }

  const veh = allocateVehicles(guests, config.vehicles, rules);

  // Day-by-day chauffeur (full_day or by_tour with tours)
  let chauffeurDayCount = 0;
  const selectionMap =
    state.chauffeurSelections &&
    Object.keys(state.chauffeurSelections).length > 0
      ? state.chauffeurSelections
      : null;
  const legacyDays = selectionMap
    ? chauffeurDaysFromSelections(selectionMap)
    : state.chauffeurDays ?? {};

  for (const [cityId, dates] of Object.entries(legacyDays)) {
    const valid = new Set(
      chauffeurDaysForCity(state.arrivalDate, state.locations, cityId).map(
        (d) => d.date
      )
    );
    let activeCount = 0;
    if (selectionMap?.[cityId]) {
      for (const date of Object.keys(selectionMap[cityId])) {
        if (!valid.has(date)) continue;
        if (isBillableChauffeurDay(selectionMap[cityId][date])) activeCount++;
      }
    } else {
      activeCount = dates.filter((d) => valid.has(d)).length;
    }
    if (activeCount === 0) continue;
    const quote = priceFleetChauffeurDay({
      cityId,
      totalPax: guests,
      vehicles: config.vehicles,
      rates: config.chauffeurRates ?? [],
    });
    if (quote?.fromRates && quote.min > 0) {
      min += quote.min * activeCount;
      max += quote.max * activeCount;
      chauffeurDayCount += activeCount;
    } else if (veh.dailyCost > 0) {
      min += veh.dailyCost * activeCount;
      max += veh.dailyCost * 1.3 * activeCount;
      chauffeurDayCount += activeCount;
    }
  }

  // Legacy global chauffeur toggle (no granular days yet)
  if (state.needDriver && chauffeurDayCount === 0) {
    const allowOnTravel = ruleBool(rules, "allow_tours_on_travel_days", false);
    const days = allowOnTravel
      ? state.durationDays
      : Math.max(1, state.durationDays - legs);
    min += veh.dailyCost * days;
    max += veh.dailyCost * 1.3 * days;
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
    currency: "EUR",
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
