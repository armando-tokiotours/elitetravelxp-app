import type { BuilderConfig, PbCity, SystemRulesMap } from "@/lib/pocketbase/client";
import {
  hotelMax,
  hotelMin,
  hubDropoff,
  hubPickup,
  ruleNumber,
  transferDropoff,
  transferPickup,
} from "@/lib/pocketbase/client";
import { calculateTourPrice } from "@/lib/tourPricing";
import {
  calculateRoomRequirements,
} from "@/lib/hotelCalculator";
import type { BuilderState } from "@/store/useBuilderStore";
import { normalizeCityHotelPref } from "@/store/useBuilderStore";
import { priceFleetTransfer, priceFleetChauffeurDay } from "@/lib/vehicleAllocator";
import { transferFeeForPax } from "@/lib/transferVehicle";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  chauffeurDaysFromSelections,
  countBillableChauffeurDays,
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";
import { sumTransitTicketCosts } from "@/lib/transitTickets";
import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import { normalizeBookingStatus } from "@/utils/pnr";

function eliteConciergeFeeAmount(rules: SystemRulesMap): number {
  const fromRules = ruleNumber(rules, "elite_concierge_fee", ELITE_CONCIERGE_FEE);
  // Product lock: €50 design deposit (ignore legacy 2800 admin values)
  return fromRules > 0 && fromRules <= 500 ? fromRules : ELITE_CONCIERGE_FEE;
}

/**
 * Net the design deposit as tour credit only on confirmed bookings when the
 * trip total already exceeds the deposit. Never wipe a concierge-only estimate
 * to €0 (that produced "Est. €0 · No add-ons selected" while Elite Concierge
 * was active).
 */
function shouldApplyConciergeTourCredit(
  state: BuilderState,
  amountBeforeCredit: number,
  fee: number
): boolean {
  if (normalizeBookingStatus(state.bookingStatus) !== "confirmed") return false;
  if (fee <= 0) return false;
  return amountBeforeCredit > fee;
}

function isConciergeMode(state: BuilderState): boolean {
  return state.isEliteConcierge || state.experienceService === "concierge";
}

/** All-inclusive daily host rate for a city (€ / day). */
export function cityDailyHostRate(city: PbCity | undefined | null): number {
  if (!city) return 0;
  const base = Number(city.base_price ?? 0) || 0;
  const mod = Number(city.base_price_modifier ?? 1) || 1;
  return Math.max(0, base * mod);
}

function hasSelectedTours(state: BuilderState): boolean {
  if ((state.selectedTourIds?.length ?? 0) > 0) return true;
  return Object.values(state.selectedTours ?? {}).some(
    (rows) => Array.isArray(rows) && rows.length > 0
  );
}

/** True when any billable chauffeur / transfer / guided experience is selected. */
export function hasPaidExperienceOrTransport(state: BuilderState): boolean {
  if (isConciergeMode(state)) return true;
  if (hasSelectedTours(state)) return true;
  if (countBillableChauffeurDays(state.chauffeurSelections) > 0) return true;

  const arrival = state.arrivalTransitType ?? "unset";
  if (arrival === "private" || arrival === "public") return true;
  if (
    state.arrivalNeedsTicket &&
    (state.arrivalTicketPricePerPax ?? 0) > 0
  ) {
    return true;
  }

  for (const loc of state.locations) {
    if (loc.transitType === "private" || loc.transitType === "public") {
      return true;
    }
    if (loc.needsTicket && (loc.ticketPricePerPax ?? 0) > 0) return true;
  }

  return false;
}

/**
 * City daily-host packaging is retired for live quotes.
 * Itemized totals = selected tours + selected transport only.
 */
function shouldApplyDailyHostRates(_state: BuilderState): boolean {
  return false;
}

/** Sum all-inclusive daily host support across city nights. */
export function sumCityDailyHostRates(
  state: BuilderState,
  cities: PbCity[]
): { min: number; max: number } {
  let min = 0;
  for (const loc of state.locations) {
    if (loc.nights < 1) continue;
    const city = cities.find((c) => c.id === loc.cityId);
    min += cityDailyHostRate(city) * loc.nights;
  }
  return { min, max: Math.round(min * 1.12) };
}

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
  // Exact itemized sum — no global / seasonal padding on the live quote
  const pricingMult = 1;
  let min = 0;
  let max = 0;

  const nights = state.locations.reduce((s, l) => s + l.nights, 0);
  const guests = state.adults + state.children;

  // Daily-host city packaging disabled (itemized tours/transport only)
  void shouldApplyDailyHostRates(state);

  if (state.needHotels && nights > 0) {
    const monthName = state.arrivalDate
      ? new Date(
          Number(state.arrivalDate.slice(0, 4)),
          Number(state.arrivalDate.slice(5, 7)) - 1,
          1
        ).toLocaleString("en-US", { month: "long" })
      : null;

    for (const loc of state.locations) {
      const prefRaw = state.cityHotels?.[loc.cityId];
      const pref = prefRaw
        ? normalizeCityHotelPref(prefRaw, loc.cityId, state.roomCount)
        : null;
      const needsHotel = pref ? pref.needsHotel : state.needHotels;
      if (!needsHotel || loc.nights < 1) continue;

      const star = pref ? `${pref.starRating}-star` : state.hotelTier;
      const breakfast = pref
        ? pref.breakfast
          ? "Included"
          : "Not Included"
        : null;

      const roomEntries: { type: string; qty: number }[] = pref
        ? [
            { type: "Standard", qty: pref.rooms.standard },
            { type: "Twin", qty: pref.rooms.twin },
            { type: "Superior", qty: pref.rooms.superior },
          ].filter((r) => r.qty > 0)
        : [{ type: state.roomType || "Standard", qty: Math.max(1, state.roomCount) }];

      // Self-arranged / no rooms allocated → €0 (do not invent rooms)
      if (roomEntries.length === 0) continue;

      for (const entry of roomEntries) {
        const scored = config.accommodations
          .map((a) => {
            let score = 0;
            const aStar = a.star_rating || a.tier;
            if (aStar === star) score += 4;
            if (
              (a.room_type || "")
                .toLowerCase()
                .includes(String(entry.type).toLowerCase())
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
          min += hotelMin(row) * entry.qty * loc.nights;
          max += hotelMax(row) * entry.qty * loc.nights;
        }
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
      max += fee;
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
      max += fee;
    }
  }

  const legs = Math.max(0, state.locations.length - 1);
  if (legs > 0) {
    let transitMin = 0;
    let transitMax = 0;
    let pricedLegs = 0;
    let billableLegs = 0;
    for (let i = 0; i < state.locations.length - 1; i++) {
      const from = state.locations[i];
      const to = state.locations[i + 1];
      if (from.transitType !== "public" && from.transitType !== "private") {
        continue;
      }
      billableLegs++;
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
        transitMax += cost;
        pricedLegs++;
      }
    }
    if (pricedLegs < billableLegs) {
      const transit = config.transitModes.find(
        (t) => t.id === state.transitModeId
      );
      if (transit) {
        const remaining = billableLegs - pricedLegs;
        const legCost =
          transit.price_per_leg * remaining * Math.max(1, guests);
        transitMin += legCost;
        transitMax += legCost;
      }
    }
    min += transitMin;
    max += transitMax;
  }

  const ticketTotal = sumTransitTicketCosts({
    guests,
    arrivalTransitType: state.arrivalTransitType ?? "unset",
    arrivalNeedsTicket: state.arrivalNeedsTicket,
    arrivalTicketPricePerPax: state.arrivalTicketPricePerPax,
    locations: state.locations,
  });
  if (ticketTotal > 0) {
    min += ticketTotal;
    max += ticketTotal;
  }

  for (const rows of Object.values(state.selectedTours ?? {})) {
    if (isConciergeMode(state)) break;
    for (const row of rows) {
      const tour = config.tours.find((t) => t.id === row.tourId);
      const p = tour
        ? calculateTourPrice(
            { adults: state.adults, children: state.children },
            tour
          )
        : Number(row.price) || 0;
      if (p > 0) {
        min += p;
        max += p;
      }
    }
  }
  if (!state.selectedTours || Object.keys(state.selectedTours).length === 0) {
    for (const id of state.selectedTourIds) {
      if (isConciergeMode(state)) break;
      const tour = config.tours.find((t) => t.id === id);
      if (tour) {
        const p = calculateTourPrice(
          { adults: state.adults, children: state.children },
          tour
        );
        min += p;
        max += p;
      }
    }
  }

  if (isConciergeMode(state)) {
    const fee = eliteConciergeFeeAmount(rules);
    min += fee;
    max += fee;
    if (shouldApplyConciergeTourCredit(state, min, fee)) {
      min -= fee;
      max -= fee;
    }
  }

  const veh = allocateVehicles(guests, config.vehicles, rules);

  // Day-by-day chauffeur (full_day or by_tour with tours) — skipped under Elite Concierge
  let chauffeurDayCount = 0;
  if (!isConciergeMode(state)) {
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
      max += veh.dailyCost * activeCount;
      chauffeurDayCount += activeCount;
    }
  }
  // No legacy needDriver full-trip padding — only explicitly selected chauffeur days
  }

  return {
    min: Math.round(min * pricingMult),
    max: Math.round(max * pricingMult),
    vehiclesNeeded: veh.label,
  };
}

export interface PriceRange {
  min: number;
  max: number;
}

/** Display vehicle for airport / chauffeur lines based on party size. */
export function invoiceVehicleDisplayName(totalGuests: number): string {
  const g = Math.max(0, totalGuests);
  if (g <= 5) return "Toyota Alphard (7-seater luxury van)";
  if (g <= 14) return "Toyota Hiace Grand Cabin (14-seater)";
  const vans = Math.ceil(g / 14);
  return `${vans}× Toyota Hiace Grand Cabin (14-seater)`;
}

export function invoiceVehicleLine(totalGuests: number): string {
  const g = Math.max(0, totalGuests);
  if (g <= 0) return "—";
  if (g <= 5) return `1x ${invoiceVehicleDisplayName(g)}`;
  if (g <= 14) return `1x ${invoiceVehicleDisplayName(g)}`;
  return invoiceVehicleDisplayName(g);
}

/**
 * Section-level quote ranges for the detailed Invoice / Print view.
 * Mirrors calculateBuilderQuote — exact itemized buckets, no global padding.
 */
export function calculateInvoiceBreakdown(
  state: BuilderState,
  config: BuilderConfig
): {
  hubs: PriceRange;
  hotels: PriceRange;
  experiences: PriceRange;
  total: PriceRange;
  vehicleLine: string;
  conciergeFee: number;
  conciergeCredit: number;
} {
  const rules = config.rules ?? {};
  const guests = state.adults + state.children;
  const vehicleLine = invoiceVehicleLine(guests);
  const pricingMult = 1;

  let hubMin = 0;
  let hubMax = 0;
  let hotelMinSum = 0;
  let hotelMaxSum = 0;
  let expMin = 0;
  let expMax = 0;

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
      hubMin += quote.min;
      hubMax += quote.max;
    } else {
      const base = arrivalHub
        ? hubPickup(arrivalHub)
        : arrivalTransfer
          ? transferPickup(arrivalTransfer)
          : 0;
      const fee = transferFeeForPax(base, guests);
      hubMin += fee;
      hubMax += fee;
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
      hubMin += quote.min;
      hubMax += quote.max;
    } else {
      const base = departureHub
        ? hubDropoff(departureHub)
        : departureTransfer
          ? transferDropoff(departureTransfer)
          : 0;
      const fee = transferFeeForPax(base, guests);
      hubMin += fee;
      hubMax += fee;
    }
  }

  const nights = state.locations.reduce((s, l) => s + l.nights, 0);
  const hasPaidExp = hasPaidExperienceOrTransport(state);
  void shouldApplyDailyHostRates(state);

  if (state.needHotels && nights > 0) {
    const monthName = state.arrivalDate
      ? new Date(
          Number(state.arrivalDate.slice(0, 4)),
          Number(state.arrivalDate.slice(5, 7)) - 1,
          1
        ).toLocaleString("en-US", { month: "long" })
      : null;

    for (const loc of state.locations) {
      const prefRaw = state.cityHotels?.[loc.cityId];
      const pref = prefRaw
        ? normalizeCityHotelPref(prefRaw, loc.cityId, state.roomCount)
        : null;
      const needsHotel = pref ? pref.needsHotel : state.needHotels;
      if (!needsHotel || loc.nights < 1) continue;

      const star = pref ? `${pref.starRating}-star` : state.hotelTier;
      const breakfast = pref
        ? pref.breakfast
          ? "Included"
          : "Not Included"
        : null;

      const roomEntries: { type: string; qty: number }[] = pref
        ? [
            { type: "Standard", qty: pref.rooms.standard },
            { type: "Twin", qty: pref.rooms.twin },
            { type: "Superior", qty: pref.rooms.superior },
          ].filter((r) => r.qty > 0)
        : [
            {
              type: state.roomType || "Standard",
              qty: Math.max(1, state.roomCount),
            },
          ];

      if (roomEntries.length === 0) continue;

      for (const entry of roomEntries) {
        const scored = config.accommodations
          .map((a) => {
            let score = 0;
            const aStar = a.star_rating || a.tier;
            if (aStar === star) score += 4;
            if (
              (a.room_type || "")
                .toLowerCase()
                .includes(String(entry.type).toLowerCase())
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
          hotelMinSum += hotelMin(row) * entry.qty * loc.nights;
          hotelMaxSum += hotelMax(row) * entry.qty * loc.nights;
        }
      }
    }
  }

  const legs = Math.max(0, state.locations.length - 1);
  if (hasPaidExp && legs > 0) {
    let pricedLegs = 0;
    let billableLegs = 0;
    for (let i = 0; i < state.locations.length - 1; i++) {
      const from = state.locations[i];
      const to = state.locations[i + 1];
      if (from.transitType !== "public" && from.transitType !== "private") {
        continue;
      }
      billableLegs++;
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
        expMin += cost;
        expMax += cost;
        pricedLegs++;
      }
    }
    if (pricedLegs < billableLegs) {
      const transit = config.transitModes.find(
        (t) => t.id === state.transitModeId
      );
      if (transit) {
        const remaining = billableLegs - pricedLegs;
        const legCost =
          transit.price_per_leg * remaining * Math.max(1, guests);
        expMin += legCost;
        expMax += legCost;
      }
    }
  }

  if (hasPaidExp) {
    const ticketTotal = sumTransitTicketCosts({
      guests,
      arrivalTransitType: state.arrivalTransitType ?? "unset",
      arrivalNeedsTicket: state.arrivalNeedsTicket,
      arrivalTicketPricePerPax: state.arrivalTicketPricePerPax,
      locations: state.locations,
    });
    if (ticketTotal > 0) {
      expMin += ticketTotal;
      expMax += ticketTotal;
    }
  }

  if (hasPaidExp) {
    for (const rows of Object.values(state.selectedTours ?? {})) {
      if (isConciergeMode(state)) break;
      for (const row of rows) {
        const tour = config.tours.find((t) => t.id === row.tourId);
        const p = tour
          ? calculateTourPrice(
              { adults: state.adults, children: state.children },
              tour
            )
          : Number(row.price) || 0;
        if (p > 0) {
          expMin += p;
          expMax += p;
        }
      }
    }
    if (!state.selectedTours || Object.keys(state.selectedTours).length === 0) {
      for (const id of state.selectedTourIds) {
        if (isConciergeMode(state)) break;
        const tour = config.tours.find((t) => t.id === id);
        if (tour) {
          const p = calculateTourPrice(
            { adults: state.adults, children: state.children },
            tour
          );
          expMin += p;
          expMax += p;
        }
      }
    }
  }

  let conciergeFee = 0;
  let conciergeCredit = 0;
  if (isConciergeMode(state)) {
    conciergeFee = eliteConciergeFeeAmount(rules);
    expMin += conciergeFee;
    expMax += conciergeFee;
    if (shouldApplyConciergeTourCredit(state, expMin, conciergeFee)) {
      conciergeCredit = conciergeFee;
      expMin -= conciergeCredit;
      expMax -= conciergeCredit;
    }
  }

  const veh = allocateVehicles(guests, config.vehicles, rules);
  let chauffeurDayCount = 0;
  if (hasPaidExp && !isConciergeMode(state)) {
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
      expMin += quote.min * activeCount;
      expMax += quote.max * activeCount;
      chauffeurDayCount += activeCount;
    } else if (veh.dailyCost > 0) {
      expMin += veh.dailyCost * activeCount;
      expMax += veh.dailyCost * activeCount;
      chauffeurDayCount += activeCount;
    }
  }
  void chauffeurDayCount;
  }

  // Hard-zero experiences when nothing billable is selected
  if (!hasPaidExp) {
    expMin = 0;
    expMax = 0;
  }

  const baseMin = hubMin + hotelMinSum + expMin;
  const baseMax = hubMax + hotelMaxSum + expMax;

  return {
    hubs: {
      min: Math.round(hubMin * pricingMult),
      max: Math.round(hubMax * pricingMult),
    },
    hotels: {
      min: Math.round(hotelMinSum * pricingMult),
      max: Math.round(hotelMaxSum * pricingMult),
    },
    experiences: {
      min: Math.round(expMin * pricingMult),
      max: Math.round(expMax * pricingMult),
    },
    total: {
      min: Math.round(baseMin * pricingMult),
      max: Math.round(baseMax * pricingMult),
    },
    vehicleLine,
    conciergeFee,
    conciergeCredit,
  };
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Compact estimate label for sticky CTAs / summary cards.
 * Concierge-only selections must never read as "No add-ons selected".
 */
export function formatEstimateSummary(opts: {
  min: number;
  max: number;
  conciergeActive: boolean;
  conciergeFee?: number;
}): string {
  const fee = Math.max(0, opts.conciergeFee ?? ELITE_CONCIERGE_FEE);
  const min = Math.max(0, Math.round(opts.min));
  const max = Math.max(0, Math.round(opts.max));

  if (opts.conciergeActive && min <= 0 && max <= 0) {
    // Defensive: calculator should already include the fee
    return `Est. ${formatUsd(fee)} · Elite Concierge Active`;
  }

  if (min <= 0 && max <= 0) {
    return `Est. ${formatUsd(0)} · No add-ons selected`;
  }

  if (opts.conciergeActive && min === max && min === fee) {
    return `Est. ${formatUsd(min)} · Elite Concierge Active`;
  }

  if (opts.conciergeActive) {
    if (min === max) {
      return `Est. ${formatUsd(min)} · Elite Concierge Active`;
    }
    return `Est. ${formatUsd(min)}–${formatUsd(max)} · Elite Concierge Active`;
  }

  if (min === max) {
    return `Est. ${formatUsd(min)} · Selected Add-ons`;
  }
  return `Est. ${formatUsd(min)}–${formatUsd(max)}`;
}

/** Suggested rooms from max_occupancy rules */
export function suggestedRooms(
  guests: number,
  occupancy: number,
  maxAdultsPerRoom: number
): number {
  const perRoom = Math.max(1, Math.min(occupancy || 2, maxAdultsPerRoom || 3));
  return (
    calculateRoomRequirements(guests, perRoom)?.roomsNeeded ??
    Math.max(1, Math.ceil(guests / perRoom))
  );
}
