/**
 * Auto-derive Step 2 arrival/departure hubs into Step 3 route as
 * locked 0-night transit stops (airports / ports).
 */

import type { PbCity, PbHub } from "@/lib/pocketbase/client";
import type { LocationStop } from "@/store/useBuilderStore";
import { coerceTransitType } from "@/store/useBuilderStore";

export const ARRIVAL_TRANSIT_KEY = "__transit_arrival__";
export const DEPARTURE_TRANSIT_KEY = "__transit_departure__";

export function isTransitHubStop(
  loc: Pick<LocationStop, "isTransitHub" | "hubId" | "key" | "visitType">
): boolean {
  if (loc.isTransitHub) return true;
  if (loc.hubId) return true;
  return (
    loc.key === ARRIVAL_TRANSIT_KEY || loc.key === DEPARTURE_TRANSIT_KEY
  );
}

/** Airports / cruise ports become 0-night transit nodes; plain city hubs do not. */
export function hubIsTransitPoint(hub: {
  name: string;
  type?: string;
}): boolean {
  if (hub.type === "Airport" || hub.type === "Cruise Terminal") return true;
  const n = hub.name.toLowerCase();
  return /airport|port|terminal|haneda|narita|kansai|chubu|itami|fukuoka|centro|yokohama|osaka|nagoya|sapporo|okinawa|naha/.test(
    n
  );
}

export function overnightStopCount(
  locations: Pick<LocationStop, "visitType" | "isTransitHub" | "hubId" | "key" | "nights">[]
): number {
  return locations.filter(
    (l) => !isTransitHubStop(l) && (l.visitType === "stay" || !l.visitType)
  ).length;
}

export function overnightNightsTotal(
  locations: Pick<LocationStop, "visitType" | "isTransitHub" | "hubId" | "key" | "nights">[]
): number {
  return locations.reduce((sum, l) => {
    if (isTransitHubStop(l) || l.visitType === "arrival" || l.visitType === "departure") {
      return sum;
    }
    return sum + (Number(l.nights) || 0);
  }, 0);
}

/**
 * Split total trip nights across non-transit stay cities.
 * Transit hubs stay at 0n. Remainder nights go to the first stay city.
 */
export function distributeStayNights<
  T extends Pick<
    LocationStop,
    "visitType" | "isTransitHub" | "hubId" | "key" | "nights"
  >,
>(locations: T[], totalTripNights: number): T[] {
  const total = Math.max(0, Math.round(Number(totalTripNights) || 0));
  const stayIndexes: number[] = [];
  locations.forEach((loc, index) => {
    if (isTransitHubStop(loc)) return;
    if (loc.visitType === "arrival" || loc.visitType === "departure") return;
    if (loc.visitType && loc.visitType !== "stay") return;
    stayIndexes.push(index);
  });

  if (stayIndexes.length === 0) return locations;

  const base = Math.floor(total / stayIndexes.length);
  const remainder = total % stayIndexes.length;

  return locations.map((loc, index) => {
    if (isTransitHubStop(loc)) {
      return { ...loc, nights: 0 };
    }
    if (loc.visitType === "arrival" || loc.visitType === "departure") {
      return { ...loc, nights: 0 };
    }
    const stayOrder = stayIndexes.indexOf(index);
    if (stayOrder < 0) return loc;
    const nights = base + (stayOrder === 0 ? remainder : 0);
    return {
      ...loc,
      nights: Math.max(0, Math.min(90, nights)),
    };
  });
}

function uid(): string {
  return `loc_${Math.random().toString(36).slice(2, 10)}`;
}

function makeTransitStop(opts: {
  key: typeof ARRIVAL_TRANSIT_KEY | typeof DEPARTURE_TRANSIT_KEY;
  hub: PbHub;
  visitType: "arrival" | "departure";
  cities: PbCity[];
}): LocationStop {
  const { key, hub, visitType, cities } = opts;
  // Prefer linked city id when present so date cascade / maps still work;
  // display name comes from hub.name in the UI.
  const linked =
    hub.city_id && cities.some((c) => c.id === hub.city_id)
      ? hub.city_id
      : hub.id;
  return {
    key,
    cityId: linked,
    hubId: hub.id,
    isTransitHub: true,
    visitType,
    nights: 0,
    transitType: "unset",
    needsTicket: false,
    ticketType: "none",
    ticketPricePerPax: 0,
  };
}

/**
 * Rebuild locations with Step 2 hubs pinned at ends.
 * Middle overnight cities are preserved (order kept).
 */
export function syncTransitHubLocations(
  locations: LocationStop[],
  opts: {
    arrivalTransferId: string | null;
    departureTransferId: string | null;
    hubs: PbHub[];
    cities: PbCity[];
  }
): LocationStop[] {
  const { arrivalTransferId, departureTransferId, hubs, cities } = opts;
  const arrivalHub = arrivalTransferId
    ? hubs.find((h) => h.id === arrivalTransferId) ?? null
    : null;
  const departureHub = departureTransferId
    ? hubs.find((h) => h.id === departureTransferId) ?? null
    : null;

  const middle: LocationStop[] = locations
    .filter((l) => !isTransitHubStop(l))
    .map((l) => {
      const { hubId: _h, ...rest } = l;
      void _h;
      return {
        ...rest,
        isTransitHub: false,
        visitType: "stay" as const,
        nights: Math.max(1, Math.min(90, Math.round(Number(l.nights) || 1))),
        transitType: coerceTransitType(l.transitType),
        key: l.key?.trim() || uid(),
      };
    });

  const next: LocationStop[] = [];

  // City arrival exception: non-transit hub → ensure first overnight is that city
  if (arrivalHub && !hubIsTransitPoint(arrivalHub)) {
    const cityId = arrivalHub.city_id || arrivalHub.id;
    if (cityId && cities.some((c) => c.id === cityId)) {
      if (!middle.length || middle[0].cityId !== cityId) {
        const rest = middle.filter((l) => l.cityId !== cityId);
        middle.length = 0;
        middle.push(
          {
            key: uid(),
            cityId,
            nights: 1,
            visitType: "stay",
            transitType: "unset",
            needsTicket: false,
            ticketType: "none",
            ticketPricePerPax: 0,
            isTransitHub: false,
          },
          ...rest
        );
      }
    }
  } else if (arrivalHub && hubIsTransitPoint(arrivalHub)) {
    next.push(
      makeTransitStop({
        key: ARRIVAL_TRANSIT_KEY,
        hub: arrivalHub,
        visitType: "arrival",
        cities,
      })
    );
  }

  next.push(...middle);

  if (departureHub && hubIsTransitPoint(departureHub)) {
    // Avoid duplicate if arrival === departure and no middle cities
    if (
      !(
        arrivalHub?.id === departureHub.id &&
        middle.length === 0 &&
        next.some((l) => l.key === ARRIVAL_TRANSIT_KEY)
      )
    ) {
      next.push(
        makeTransitStop({
          key: DEPARTURE_TRANSIT_KEY,
          hub: departureHub,
          visitType: "departure",
          cities,
        })
      );
    }
  } else if (departureHub && !hubIsTransitPoint(departureHub)) {
    const cityId = departureHub.city_id || departureHub.id;
    if (cityId && cities.some((c) => c.id === cityId)) {
      const last = next.filter((l) => !isTransitHubStop(l));
      if (!last.length || last[last.length - 1].cityId !== cityId) {
        // append as overnight if missing
        const exists = next.some(
          (l) => !isTransitHubStop(l) && l.cityId === cityId
        );
        if (!exists) {
          next.push({
            key: uid(),
            cityId,
            nights: 1,
            visitType: "stay",
            transitType: "unset",
            needsTicket: false,
            ticketType: "none",
            ticketPricePerPax: 0,
            isTransitHub: false,
          });
        }
      }
    }
  }

  return pinTransitHubs(next);
}

/** Keep transit hubs pinned at ends; middle stays only reorderable. */
export function pinTransitHubs(locations: LocationStop[]): LocationStop[] {
  const arrival = locations.find((l) => l.key === ARRIVAL_TRANSIT_KEY);
  const departure = locations.find((l) => l.key === DEPARTURE_TRANSIT_KEY);
  const middle = locations.filter((l) => !isTransitHubStop(l));
  const out: LocationStop[] = [];
  if (arrival) {
    out.push({
      ...arrival,
      isTransitHub: true,
      visitType: "arrival",
      nights: 0,
    });
  }
  for (const loc of middle) {
    const { hubId: _h, ...rest } = loc;
    void _h;
    out.push({
      ...rest,
      isTransitHub: false,
      visitType: "stay",
      nights: Math.max(1, Math.min(90, Math.round(Number(loc.nights) || 1))),
    });
  }
  if (departure) {
    out.push({
      ...departure,
      isTransitHub: true,
      visitType: "departure",
      nights: 0,
    });
  }
  return out;
}
