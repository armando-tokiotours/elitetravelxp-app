import {
  allocateVehicles,
  BASE_SERVICE_FEE,
  CHAUFFEUR_DAILY,
  CITIES,
  DAILY_GUEST_BUFFER,
  HOTEL_RATES,
  HUBS,
  TOUR_PACKAGES,
  TRANSFER_FEES,
  TRANSIT_RATES,
  type CityId,
} from "@/config/pricing-data";
import type { ItineraryState } from "@/store/useItineraryStore";
import { totalAssignedNights, totalRooms } from "@/store/useItineraryStore";

export interface PriceBreakdownLine {
  label: string;
  min: number;
  max: number;
}

export interface QuotationResult {
  min: number;
  max: number;
  lines: PriceBreakdownLine[];
  vehicles: ReturnType<typeof allocateVehicles>;
  nightsAssigned: number;
  nightsRequired: number;
  nightsValid: boolean;
  cityCount: number;
  roomCount: number;
  interCityLegs: number;
  tourableDays: number;
}

function cityLabel(id: CityId): string {
  return CITIES.find((c) => c.id === id)?.label ?? id;
}

export function calculateQuotation(state: ItineraryState): QuotationResult {
  const lines: PriceBreakdownLine[] = [];
  let min = 0;
  let max = 0;

  const add = (label: string, a: number, b: number) => {
    if (a === 0 && b === 0) return;
    lines.push({ label, min: a, max: b });
    min += a;
    max += b;
  };

  // Base concierge / planning
  add("Concierge & planning fee", BASE_SERVICE_FEE.min, BASE_SERVICE_FEE.max);

  // Hotels
  const nightsAssigned = totalAssignedNights(state.cityNights);
  // Spec: total nights across cities must match selected duration
  const nightsRequired = state.durationDays;
  const nightsValid =
    state.cityNights.length === 0
      ? nightsRequired === 0
      : nightsAssigned === nightsRequired;
  const roomCount = totalRooms(state.rooms);

  if (state.needHotels && roomCount > 0 && nightsAssigned > 0) {
    let hMin = 0;
    let hMax = 0;
    for (const room of state.rooms) {
      if (room.count <= 0) continue;
      const rate = HOTEL_RATES[state.hotelTier][room.type];
      hMin += rate.min * room.count * nightsAssigned;
      hMax += rate.max * room.count * nightsAssigned;
    }
    add(
      `Accommodation (${state.hotelTier === "5-star" ? "5★ Ultra Luxury" : "4★ Luxury"} × ${nightsAssigned} nights)`,
      hMin,
      hMax
    );
  }

  // Transfers
  const vehicles = allocateVehicles(state.totalGuests);
  const vehicleMultiplier = Math.max(
    1,
    vehicles.alphards + vehicles.hiaces || 1
  );

  if (state.pickupTransfer && state.arrivalHub) {
    const fee = TRANSFER_FEES[state.arrivalHub];
    add(
      `Arrival transfer — ${HUBS.find((h) => h.id === state.arrivalHub)?.short}`,
      fee.min * vehicleMultiplier,
      fee.max * vehicleMultiplier
    );
  }
  if (state.dropoffTransfer && state.departureHub) {
    const fee = TRANSFER_FEES[state.departureHub];
    add(
      `Departure transfer — ${HUBS.find((h) => h.id === state.departureHub)?.short}`,
      fee.min * vehicleMultiplier,
      fee.max * vehicleMultiplier
    );
  }

  // Inter-city legs = cities - 1 (travel days between stays)
  const interCityLegs = Math.max(0, state.cityNights.length - 1);
  if (interCityLegs > 0) {
    const rate = TRANSIT_RATES[state.transitMode];
    if (rate.unit === "per-guest-leg") {
      add(
        `Inter-city transit (${interCityLegs} legs · Shinkansen Gran Class)`,
        rate.min * state.totalGuests * interCityLegs,
        rate.max * state.totalGuests * interCityLegs
      );
    } else {
      add(
        `Inter-city transit (${interCityLegs} legs · Private chauffeur)`,
        rate.min * vehicleMultiplier * interCityLegs,
        rate.max * vehicleMultiplier * interCityLegs
      );
    }
  }

  // Tours — business rule: no tours on inter-city travel days
  // Available tour days ≈ total days - travel days - 1 arrival buffer (soft)
  const tourableDays = Math.max(0, state.durationDays - interCityLegs);
  for (const tourId of state.selectedTours) {
    const tour = TOUR_PACKAGES.find((t) => t.id === tourId);
    if (!tour) continue;
    if (!state.cityNights.some((c) => c.cityId === tour.cityId)) continue;
    add(`Tour: ${tour.name} (${cityLabel(tour.cityId)})`, tour.priceMin, tour.priceMax);
  }

  // Private chauffeur for tour / in-city days
  if (state.privateChauffeur) {
    const chauffeurDays = Math.max(1, tourableDays);
    add(
      `Private chauffeur (${chauffeurDays} days)`,
      CHAUFFEUR_DAILY.min * chauffeurDays,
      CHAUFFEUR_DAILY.max * chauffeurDays
    );
  }

  // Soft daily experience buffer
  add(
    `Experience allowance (${state.durationDays} days × ${state.totalGuests} guests)`,
    DAILY_GUEST_BUFFER.min * state.durationDays * state.totalGuests,
    DAILY_GUEST_BUFFER.max * state.durationDays * state.totalGuests
  );

  return {
    min: Math.round(min),
    max: Math.round(max),
    lines,
    vehicles,
    nightsAssigned,
    nightsRequired,
    nightsValid,
    cityCount: state.cityNights.length,
    roomCount,
    interCityLegs,
    tourableDays,
  };
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
