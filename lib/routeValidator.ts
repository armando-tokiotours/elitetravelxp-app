/** Smart route & hub mismatch warnings for Step 3. */

export interface RouteHubLike {
  name: string;
  city_id?: string;
}

export interface RouteCityLike {
  id: string;
  name: string;
}

export interface RouteLocationLike {
  cityId: string;
  isTransitHub?: boolean;
  visitType?: string;
  key?: string;
}

export interface CityMovementLike {
  from_city_id: string;
  to_city_id: string;
  is_recommended_order?: boolean;
}

export type RouteWarningType =
  | "arrival_mismatch"
  | "departure_mismatch"
  | "inefficient";

export interface RouteWarning {
  type: RouteWarningType;
  title: string;
  body: string;
}

function cityName(
  id: string | undefined,
  cities: RouteCityLike[],
  fallback = "that city"
): string {
  if (!id) return fallback;
  return cities.find((c) => c.id === id)?.name ?? fallback;
}

function hubCityLabel(hub: RouteHubLike, cities: RouteCityLike[]): string {
  const linked = cityName(hub.city_id, cities, "");
  if (linked) return `${hub.name} (${linked})`;
  return hub.name;
}

/** Overnight / stay stops only — hubs are not middle route nodes. */
function stayLocations(locations: RouteLocationLike[]): RouteLocationLike[] {
  return locations.filter((l) => {
    if (l.isTransitHub) return false;
    if (l.key === "__transit_arrival__" || l.key === "__transit_departure__") {
      return false;
    }
    if (l.visitType === "arrival" || l.visitType === "departure") return false;
    return Boolean(l.cityId);
  });
}

/** Drop consecutive duplicate city ids (Tokyo, Tokyo → Tokyo). */
export function collapseConsecutiveCityIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (out.length && out[out.length - 1] === id) continue;
    out.push(id);
  }
  return out;
}

/** Unique city ids preserving first-seen order. */
function uniqueCityIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Topological order of unique selected cities using recommended directed edges.
 * Never emits consecutive duplicates (queue is built from unique ids only).
 */
function suggestOrder(
  cityIds: string[],
  movements: CityMovementLike[],
  cities: RouteCityLike[]
): string[] | null {
  const uniqueIds = uniqueCityIdsPreserveOrder(cityIds);
  if (uniqueIds.length < 2) return null;

  const selected = new Set(uniqueIds);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of uniqueIds) {
    indeg.set(id, 0);
    adj.set(id, []);
  }

  let edgeCount = 0;
  for (const m of movements) {
    if (m.is_recommended_order === false) continue;
    if (!selected.has(m.from_city_id) || !selected.has(m.to_city_id)) continue;
    if (m.from_city_id === m.to_city_id) continue;
    adj.get(m.from_city_id)!.push(m.to_city_id);
    indeg.set(m.to_city_id, (indeg.get(m.to_city_id) ?? 0) + 1);
    edgeCount++;
  }
  if (edgeCount === 0) return null;

  // Unique queue only — duplicate cityIds must not enqueue the same node twice
  const queue = uniqueIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const ordered: string[] = [];
  const visited = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => uniqueIds.indexOf(a) - uniqueIds.indexOf(b));
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);
    ordered.push(next);
    for (const to of adj.get(next) ?? []) {
      const d = (indeg.get(to) ?? 1) - 1;
      indeg.set(to, d);
      if (d === 0 && !visited.has(to)) queue.push(to);
    }
  }

  if (ordered.length !== uniqueIds.length) return null;
  if (ordered.every((id, i) => id === uniqueIds[i])) return null;

  if (ordered.some((id) => !cities.some((c) => c.id === id))) return null;
  return ordered;
}

/**
 * Pin arrival / departure hub cities at the ends; only middle nodes move.
 * Legitimate split-stays (Tokyo → Kyoto → Tokyo) keep the return leg.
 */
function applyHubAnchors(
  orderedUnique: string[],
  arrivalCityId: string | undefined,
  departureCityId: string | undefined
): string[] {
  const arrival = arrivalCityId?.trim() || "";
  const departure = departureCityId?.trim() || "";
  let middle = [...orderedUnique];

  if (arrival) {
    middle = middle.filter((id) => id !== arrival);
  }
  if (departure && departure !== arrival) {
    middle = middle.filter((id) => id !== departure);
  } else if (departure && departure === arrival) {
    // Return to same hub city: keep middle without the hub city
    middle = middle.filter((id) => id !== arrival);
  }

  const path: string[] = [];
  if (arrival) path.push(arrival);
  path.push(...middle);
  if (departure) {
    if (path[path.length - 1] !== departure) path.push(departure);
  }

  return collapseConsecutiveCityIds(path);
}

function legIsAgainstRecommended(
  fromId: string,
  toId: string,
  movements: CityMovementLike[]
): boolean {
  if (fromId === toId) return false;
  const forward = movements.find(
    (m) => m.from_city_id === fromId && m.to_city_id === toId
  );
  const reverse = movements.find(
    (m) => m.from_city_id === toId && m.to_city_id === fromId
  );

  if (forward && forward.is_recommended_order === false) return true;
  if (forward && forward.is_recommended_order === true) return false;
  if (reverse && reverse.is_recommended_order === true) return true;
  return false;
}

/**
 * Returns warning alerts when arrival/departure hubs don't match first/last
 * city, or when the city sequence backtracks against recommended movements.
 */
export function validateCityRoute(
  arrivalHub: RouteHubLike | null | undefined,
  departureHub: RouteHubLike | null | undefined,
  locations: RouteLocationLike[],
  cities: RouteCityLike[],
  movements: CityMovementLike[] = []
): RouteWarning[] {
  const warnings: RouteWarning[] = [];
  const stays = stayLocations(locations);
  if (stays.length === 0) return warnings;

  const first = stays[0];
  const last = stays[stays.length - 1];
  const firstName = cityName(first.cityId, cities, "your first city");
  const lastName = cityName(last.cityId, cities, "your last city");

  if (arrivalHub?.city_id && arrivalHub.city_id !== first.cityId) {
    const hubLabel = hubCityLabel(arrivalHub, cities);
    warnings.push({
      type: "arrival_mismatch",
      title: "Route Notice",
      body: `Your trip arrives at ${hubLabel}, but your first stay is set to ${firstName}. Consider starting in ${cityName(arrivalHub.city_id, cities)} or adding an airport transfer.`,
    });
  }

  if (departureHub?.city_id && departureHub.city_id !== last.cityId) {
    const hubLabel = hubCityLabel(departureHub, cities);
    warnings.push({
      type: "departure_mismatch",
      title: "Route Notice",
      body: `Your trip departs from ${hubLabel}, but your last stay is ${lastName}. You may need an inter-city transfer on departure day.`,
    });
  }

  const stayIdsCollapsed = collapseConsecutiveCityIds(
    stays.map((l) => l.cityId)
  );

  if (stayIdsCollapsed.length >= 2 && movements.length > 0) {
    let against = 0;
    for (let i = 0; i < stayIdsCollapsed.length - 1; i++) {
      if (
        legIsAgainstRecommended(
          stayIdsCollapsed[i],
          stayIdsCollapsed[i + 1],
          movements
        )
      ) {
        against++;
      }
    }

    if (against > 0) {
      const suggestedCore = suggestOrder(stayIdsCollapsed, movements, cities);
      if (suggestedCore) {
        const anchored = applyHubAnchors(
          suggestedCore,
          arrivalHub?.city_id || stayIdsCollapsed[0],
          departureHub?.city_id ||
            stayIdsCollapsed[stayIdsCollapsed.length - 1]
        );
        const pathNames = collapseConsecutiveCityIds(anchored)
          .map((id) => cityName(id, cities))
          .filter(Boolean);
        // Final name-level consecutive dedupe (two ids → same display name)
        const pathDisplay: string[] = [];
        for (const name of pathNames) {
          if (
            pathDisplay.length &&
            pathDisplay[pathDisplay.length - 1] === name
          ) {
            continue;
          }
          pathDisplay.push(name);
        }
        const path = pathDisplay.join(" → ");
        if (path) {
          warnings.push({
            type: "inefficient",
            title: "Route Efficiency Hint",
            body: `We recommend ordering your stay as ${path} to minimize transit time.`,
          });
        }
      } else {
        warnings.push({
          type: "inefficient",
          title: "Route Efficiency Hint",
          body: "Your city sequence may involve backtracking. Reorder stays to travel in one geographic direction when possible.",
        });
      }
    }
  }

  return warnings;
}
