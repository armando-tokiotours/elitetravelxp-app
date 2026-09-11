import PocketBase from "pocketbase";

export function getPbBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000" || port === "3001" || port === "3200") {
      return `${protocol}//${hostname}:8091`;
    }
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    process.env.PUBLIC_URL ||
    "http://127.0.0.1:8090"
  );
}

let client: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  const url = getPbBaseUrl();
  if (!client || client.baseUrl !== url) {
    client = new PocketBase(url);
  }
  return client;
}

export function createPocketBase(): PocketBase {
  return new PocketBase(getPbBaseUrl());
}

export function pbFileUrl(
  collectionIdOrName: string,
  recordId: string,
  filename: string,
  thumb?: string
): string {
  if (!filename) return "";
  const base = `${getPbBaseUrl()}/api/files/${collectionIdOrName}/${recordId}/${encodeURIComponent(filename)}`;
  return thumb ? `${base}?thumb=${thumb}` : base;
}

/** Prefer new field names; fall back to legacy columns during migration. */
export function cityPhoto(city: PbCity): string {
  return city.cover_photo || city.image || "";
}

export function tourPhoto(tour: PbTour): string {
  return tour.cover_photo || tour.image || "";
}

export function tourPrice(tour: PbTour): number {
  return Number(tour.price_per_person ?? tour.price ?? 0);
}

export function transferLocation(t: PbTransfer): string {
  return t.location_name || t.location || "";
}

export function transferPickup(t: PbTransfer): number {
  return Number(t.base_pickup_fee ?? t.pickup_fee ?? 0);
}

export function transferDropoff(t: PbTransfer): number {
  return Number(t.base_dropoff_fee ?? t.dropoff_fee ?? 0);
}

export function hotelMin(a: PbAccommodation): number {
  return Number(a.min_price_per_night ?? a.min_price ?? 0);
}

export function hotelMax(a: PbAccommodation): number {
  return Number(a.max_price_per_night ?? a.max_price ?? 0);
}

export interface PbCity {
  id: string;
  name: string;
  description?: string;
  cover_photo?: string;
  /** @deprecated legacy */
  image?: string;
  is_active?: boolean;
  sort_order?: number;
  collectionId: string;
  collectionName: string;
}

export interface PbAccommodation {
  id: string;
  tier: "4-star" | "5-star";
  room_type: string;
  min_price_per_night?: number;
  max_price_per_night?: number;
  max_occupancy?: number;
  /** @deprecated legacy */
  min_price?: number;
  max_price?: number;
}

export interface PbVehicle {
  id: string;
  name: string;
  max_passengers: number;
  max_luggage?: number;
  price_per_day: number;
  vehicle_image?: string;
  /** @deprecated legacy */
  type?: string;
}

export interface PbTransfer {
  id: string;
  location_name?: string;
  type?: "Arrival" | "Departure" | "Both";
  base_pickup_fee?: number;
  base_dropoff_fee?: number;
  /** @deprecated legacy */
  location?: string;
  pickup_fee?: number;
  dropoff_fee?: number;
}

export interface PbTour {
  id: string;
  city_id: string;
  title: string;
  description?: string;
  cover_photo?: string;
  price_per_person?: number;
  duration_hours?: number;
  is_active?: boolean;
  collectionId?: string;
  /** @deprecated legacy */
  image?: string;
  price?: number;
  expand?: { city_id?: PbCity };
}

export interface PbTransitMode {
  id: string;
  label: string;
  price_per_leg: number;
}

export interface PbAppSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export type SystemRulesMap = Record<string, string>;

export const DEFAULT_APP_SETTINGS: {
  key: string;
  value: string;
  description: string;
}[] = [
  {
    key: "max_adults_per_room",
    value: "3",
    description:
      "Maximum adults allowed per hotel room when suggesting room counts.",
  },
  {
    key: "second_vehicle_guest_threshold",
    value: "3",
    description:
      "If guest count exceeds this, allocate a second vehicle / larger van.",
  },
  {
    key: "allow_tours_on_travel_days",
    value: "false",
    description:
      "When true, tours may be scheduled on inter-city travel days.",
  },
  {
    key: "pricing_multiplier",
    value: "1",
    description: "Global markup applied to the live quotation estimate.",
  },
  {
    key: "seasonal_markup_percentage",
    value: "0",
    description: "Extra seasonal markup percentage (e.g. 10 = +10%).",
  },
];

/** @deprecated use DEFAULT_APP_SETTINGS */
export const DEFAULT_SYSTEM_RULES = DEFAULT_APP_SETTINGS.map((s) => ({
  key: s.key,
  value: s.value,
  label: s.description,
  group: "general",
}));

export interface BuilderConfig {
  cities: PbCity[];
  accommodations: PbAccommodation[];
  vehicles: PbVehicle[];
  transfers: PbTransfer[];
  tours: PbTour[];
  transitModes: PbTransitMode[];
  rules: SystemRulesMap;
}

export function rulesToMap(
  rows: { key: string; value: string }[]
): SystemRulesMap {
  return Object.fromEntries(rows.map((r) => [r.key, String(r.value)]));
}

export function ruleNumber(
  rules: SystemRulesMap,
  key: string,
  fallback: number
): number {
  const n = Number(rules[key]);
  return Number.isFinite(n) ? n : fallback;
}

export function ruleBool(
  rules: SystemRulesMap,
  key: string,
  fallback: boolean
): boolean {
  const v = rules[key];
  if (v === undefined) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

export async function fetchBuilderConfig(): Promise<BuilderConfig> {
  const pb = getPocketBase();

  const [
    citiesRaw,
    accommodations,
    vehicles,
    transfers,
    toursRaw,
    transitModes,
    settingsRows,
    legacyRules,
  ] = await Promise.all([
    pb.collection("cities").getFullList<PbCity>({ sort: "sort_order,name" }),
    pb.collection("accommodations").getFullList<PbAccommodation>({
      sort: "tier,room_type",
    }),
    pb.collection("vehicles").getFullList<PbVehicle>({
      sort: "max_passengers",
    }),
    pb.collection("transfers").getFullList<PbTransfer>(),
    pb.collection("tours").getFullList<PbTour>({
      sort: "title",
      expand: "city_id",
    }),
    pb
      .collection("transit_modes")
      .getFullList<PbTransitMode>({ sort: "label" })
      .catch(() => [] as PbTransitMode[]),
    pb
      .collection("app_settings")
      .getFullList<PbAppSetting>({ sort: "key" })
      .catch(() => [] as PbAppSetting[]),
    pb
      .collection("system_rules")
      .getFullList<{ key: string; value: string }>({ sort: "key" })
      .catch(() => [] as { key: string; value: string }[]),
  ]);

  const cities = citiesRaw.filter((c) => c.is_active !== false);
  const tours = toursRaw.filter((t) => t.is_active !== false);

  const rules = {
    ...Object.fromEntries(DEFAULT_APP_SETTINGS.map((r) => [r.key, r.value])),
    ...rulesToMap(legacyRules),
    ...rulesToMap(settingsRows),
  };

  // Map seasonal_markup_percentage → multiplier if seasonal_multiplier absent
  if (rules.seasonal_markup_percentage != null && rules.seasonal_multiplier == null) {
    const pct = Number(rules.seasonal_markup_percentage) || 0;
    rules.seasonal_multiplier = String(1 + pct / 100);
  }

  return {
    cities,
    accommodations,
    vehicles,
    transfers,
    tours,
    transitModes,
    rules,
  };
}

export async function ensureDefaultRules(pb: PocketBase): Promise<void> {
  const existing = await pb.collection("app_settings").getFullList<PbAppSetting>();
  const have = new Set(existing.map((r) => r.key));
  for (const rule of DEFAULT_APP_SETTINGS) {
    if (!have.has(rule.key)) {
      await pb.collection("app_settings").create(rule);
    }
  }
}
