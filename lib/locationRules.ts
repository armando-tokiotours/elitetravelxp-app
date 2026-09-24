import type { CityVisitType, LocationStop } from "@/store/useBuilderStore";
import { coerceTransitType } from "@/store/useBuilderStore";

/** Visit types allowed for a stop at `index` in a list of `length`. */
export function allowedVisitTypesForIndex(
  index: number,
  length: number
): CityVisitType[] {
  if (length <= 0) return ["stay"];
  if (length === 1) return ["stay", "arrival", "departure"];
  if (index === 0) return ["stay", "arrival"];
  if (index === length - 1) return ["stay", "departure"];
  return ["stay"];
}

/** True if any two adjacent stops share the same cityId. */
export function hasConsecutiveDuplicateCities(
  locations: Pick<LocationStop, "cityId">[]
): boolean {
  for (let i = 1; i < locations.length; i++) {
    if (locations[i].cityId === locations[i - 1].cityId) return true;
  }
  return false;
}

/**
 * Coerce visitType/nights to a valid value for the stop's position.
 * Departure dragged to first → Arrival; Arrival dragged to last → Departure;
 * otherwise invalid types fall back to Stay.
 */
export function coerceVisitTypeForPosition(
  visitType: CityVisitType | undefined,
  index: number,
  length: number
): CityVisitType {
  const allowed = allowedVisitTypesForIndex(index, length);
  const current: CityVisitType =
    visitType === "arrival" || visitType === "departure" ? visitType : "stay";
  if (allowed.includes(current)) return current;
  if (current === "departure" && allowed.includes("arrival")) return "arrival";
  if (current === "arrival" && allowed.includes("departure")) return "departure";
  return "stay";
}

/** Apply position-based visitType fixes across the whole route. */
export function correctLocationVisitTypes(
  locations: LocationStop[]
): LocationStop[] {
  const len = locations.length;
  return locations.map((loc, index) => {
    const isHub = Boolean(
      loc.isTransitHub ||
        loc.hubId ||
        loc.key === "__transit_arrival__" ||
        loc.key === "__transit_departure__"
    );
    if (isHub) {
      const visitType =
        loc.key === "__transit_departure__" || loc.visitType === "departure"
          ? ("departure" as const)
          : ("arrival" as const);
      return {
        ...loc,
        isTransitHub: true,
        visitType,
        nights: 0,
        transitType: coerceTransitType(loc.transitType),
      };
    }
    const visitType = coerceVisitTypeForPosition(loc.visitType, index, len);
    // Overnight cities in the middle of a hub-pinned route stay as stay
    const forcedStay =
      locations.some(
        (l) =>
          l.isTransitHub ||
          l.key === "__transit_arrival__" ||
          l.key === "__transit_departure__"
      ) && visitType !== "stay"
        ? ("stay" as const)
        : visitType;
    const nights =
      forcedStay === "stay"
        ? Math.max(1, Math.min(90, Math.round(Number(loc.nights) || 1)))
        : 0;
    return {
      ...loc,
      isTransitHub: false,
      hubId: undefined,
      visitType: forcedStay,
      nights,
      transitType: coerceTransitType(loc.transitType),
    };
  });
}

/** Whether `cityId` may be appended (not consecutive with current last stop). */
export function canAppendCity(
  locations: Pick<LocationStop, "cityId">[],
  cityId: string
): boolean {
  const last = locations[locations.length - 1];
  if (!last) return true;
  return last.cityId !== cityId;
}
