import PocketBase from "pocketbase";

/**
 * Resolve PocketBase base URL in the browser.
 * Prefer the page origin so HTTP vs HTTPS matches how the user opened the site.
 * Direct Next ports (3000/3001/3200) fall back to host :80/:443 via hostname only.
 */
export function getPbBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // Direct Next.js publish ports → talk to PocketBase publish port
    if (port === "3000" || port === "3001" || port === "3200") {
      return `${protocol}//${hostname}:8091`;
    }
    // Via host Nginx (80/443) → same origin proxies /api and /_/
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

/** Fresh client for admin sessions (avoids sharing auth with public fetches). */
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

export interface PbCity {
  id: string;
  name: string;
  description?: string;
  image: string;
  base_price?: number;
  base_price_modifier?: number;
  sort_order?: number;
  collectionId: string;
  collectionName: string;
}

export interface PbAccommodation {
  id: string;
  tier: "4-star" | "5-star";
  room_type: string;
  min_price: number;
  max_price: number;
}

export interface PbVehicle {
  id: string;
  name?: string;
  type?: string;
  max_passengers: number;
  price_per_day: number;
}

export interface PbTransfer {
  id: string;
  location: string;
  pickup_fee: number;
  dropoff_fee: number;
}

export interface PbTour {
  id: string;
  city_id: string;
  title: string;
  description?: string;
  image?: string;
  price: number;
  collectionId?: string;
  expand?: { city_id?: PbCity };
}

export interface PbTransitMode {
  id: string;
  label: string;
  price_per_leg: number;
}

export interface PbSystemRule {
  id: string;
  key: string;
  value: string;
  label?: string;
  group?: string;
}

export type SystemRulesMap = Record<string, string>;

export const DEFAULT_SYSTEM_RULES: {
  key: string;
  value: string;
  label: string;
  group: string;
}[] = [
  {
    key: "max_adults_per_room",
    value: "3",
    label: "Max adults per room",
    group: "hotels",
  },
  {
    key: "second_vehicle_guest_threshold",
    value: "3",
    label: "Guests before a second vehicle is assigned",
    group: "vehicles",
  },
  {
    key: "allow_tours_on_travel_days",
    value: "false",
    label: "Allow tours on inter-city travel days",
    group: "transit",
  },
  {
    key: "pricing_multiplier",
    value: "1",
    label: "Global pricing multiplier",
    group: "pricing",
  },
  {
    key: "seasonal_multiplier",
    value: "1",
    label: "Seasonal pricing multiplier",
    group: "pricing",
  },
];

export interface BuilderConfig {
  cities: PbCity[];
  accommodations: PbAccommodation[];
  vehicles: PbVehicle[];
  transfers: PbTransfer[];
  tours: PbTour[];
  transitModes: PbTransitMode[];
  rules: SystemRulesMap;
}

export function rulesToMap(rows: PbSystemRule[]): SystemRulesMap {
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function ruleNumber(rules: SystemRulesMap, key: string, fallback: number): number {
  const n = Number(rules[key]);
  return Number.isFinite(n) ? n : fallback;
}

export function ruleBool(rules: SystemRulesMap, key: string, fallback: boolean): boolean {
  const v = rules[key];
  if (v === undefined) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

export async function fetchBuilderConfig(): Promise<BuilderConfig> {
  const pb = getPocketBase();

  const [
    cities,
    accommodations,
    vehicles,
    transfers,
    tours,
    transitModes,
    rulesRows,
  ] = await Promise.all([
    pb.collection("cities").getFullList<PbCity>({ sort: "sort_order,name" }),
    pb.collection("accommodations").getFullList<PbAccommodation>({
      sort: "tier,room_type",
    }),
    pb.collection("vehicles").getFullList<PbVehicle>({
      sort: "max_passengers",
    }),
    pb.collection("transfers").getFullList<PbTransfer>({ sort: "location" }),
    pb.collection("tours").getFullList<PbTour>({
      sort: "title",
      expand: "city_id",
    }),
    pb.collection("transit_modes").getFullList<PbTransitMode>({
      sort: "label",
    }),
    pb
      .collection("system_rules")
      .getFullList<PbSystemRule>({ sort: "group,key" })
      .catch(() => [] as PbSystemRule[]),
  ]);

  const rules = {
    ...Object.fromEntries(DEFAULT_SYSTEM_RULES.map((r) => [r.key, r.value])),
    ...rulesToMap(rulesRows),
  };

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
  const existing = await pb.collection("system_rules").getFullList<PbSystemRule>();
  const have = new Set(existing.map((r) => r.key));
  for (const rule of DEFAULT_SYSTEM_RULES) {
    if (!have.has(rule.key)) {
      await pb.collection("system_rules").create(rule);
    }
  }
}
