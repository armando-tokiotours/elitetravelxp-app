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

/** Topological order of selected cities using recommended directed edges. */
function suggestOrder(
  cityIds: string[],
  movements: CityMovementLike[],
  cities: RouteCityLike[]
): string[] | null {
  const selected = new Set(cityIds);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of cityIds) {
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

  const queue = cityIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const ordered: string[] = [];
  while (queue.length) {
    // Stable: prefer earlier appearance in current list when ties
    queue.sort((a, b) => cityIds.indexOf(a) - cityIds.indexOf(b));
    const next = queue.shift()!;
    ordered.push(next);
    for (const to of adj.get(next) ?? []) {
      const d = (indeg.get(to) ?? 1) - 1;
      indeg.set(to, d);
      if (d === 0) queue.push(to);
    }
  }

  if (ordered.length !== cityIds.length) return null;
  if (ordered.every((id, i) => id === cityIds[i])) return null;

  // Ensure names resolve
  if (ordered.some((id) => !cities.some((c) => c.id === id))) return null;
  return ordered;
}

function legIsAgainstRecommended(
  fromId: string,
  toId: string,
  movements: CityMovementLike[]
): boolean {
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
  if (locations.length === 0) return warnings;

  const first = locations[0];
  const last = locations[locations.length - 1];
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

  if (locations.length >= 2 && movements.length > 0) {
    let against = 0;
    for (let i = 0; i < locations.length - 1; i++) {
      if (
        legIsAgainstRecommended(
          locations[i].cityId,
          locations[i + 1].cityId,
          movements
        )
      ) {
        against++;
      }
    }

    if (against > 0) {
      const ids = locations.map((l) => l.cityId);
      const suggested = suggestOrder(ids, movements, cities);
      if (suggested) {
        const path = suggested
          .map((id) => cityName(id, cities))
          .join(" → ");
        warnings.push({
          type: "inefficient",
          title: "Route Efficiency Hint",
          body: `We recommend ordering your stay as ${path} to minimize transit time.`,
        });
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
