import PocketBase from "pocketbase";

export function getPbBaseUrl(): string {
  // Prefer explicit env (set in .env.local for local, Docker build args for VPS).
  const fromEnv =
    process.env.NEXT_PUBLIC_POCKETBASE_URL || process.env.PUBLIC_URL || "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // Local Next.js → local PocketBase on 8090
    if (port === "3000" || port === "3001") {
      return `${protocol}//${hostname}:8090`;
    }
    // VPS host-mapped Next (:3200) → PocketBase on :8091
    if (port === "3200") {
      return `${protocol}//${hostname}:8091`;
    }
    // Production behind same-origin Nginx
    return window.location.origin;
  }

  return "http://127.0.0.1:8090";
}

let client: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  const url = getPbBaseUrl();
  if (!client || client.baseUrl !== url) {
    client = new PocketBase(url);
    // React Strict Mode + parallel panels share one client; default auto-cancel
    // aborts in-flight duplicate GETs (e.g. site_branding) with a confusing error.
    client.autoCancellation(false);
  }
  return client;
}

export function createPocketBase(): PocketBase {
  const pb = new PocketBase(getPbBaseUrl());
  pb.autoCancellation(false);
  return pb;
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
  return Number(a.price_min ?? a.min_price_per_night ?? a.min_price ?? 0);
}

export function hotelMax(a: PbAccommodation): number {
  return Number(a.price_max ?? a.max_price_per_night ?? a.max_price ?? 0);
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
  city_id?: string;
  star_rating?: "3-star" | "4-star" | "5-star";
  month?: string;
  season_tier?: "Low" | "Mid" | "High";
  breakfast?: "Included" | "Not Included";
  price_min?: number;
  price_max?: number;
  tier: "4-star" | "5-star" | "3-star" | string;
  room_type: string;
  min_price_per_night?: number;
  max_price_per_night?: number;
  max_occupancy?: number;
  /** @deprecated legacy */
  min_price?: number;
  max_price?: number;
  collectionId?: string;
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

export interface PbHub {
  id: string;
  name: string;
  type: "Airport" | "Cruise Terminal";
  city_id?: string;
  pickup_fee?: number;
  dropoff_fee?: number;
  is_active?: boolean;
  sort_order?: number;
  collectionId?: string;
}

export function hubPickup(h: PbHub): number {
  return Number(h.pickup_fee ?? 0);
}

export function hubDropoff(h: PbHub): number {
  return Number(h.dropoff_fee ?? 0);
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

export interface PbSeasonalHighlight {
  id: string;
  title: string;
  city_id?: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  description?: string;
  suggested_tour_id?: string;
  badge_text?: string;
  cover_photo?: string;
  is_active?: boolean;
  collectionId: string;
}

export interface PbSeasonTier {
  id: string;
  month: string;
  start_day: number;
  end_day: number;
  tier: "Low" | "Mid" | "High";
  crowd_level?: string;
  concierge_note?: string;
  sort_order?: number;
  is_active?: boolean;
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

export interface PbSiteBranding {
  id: string;
  logo_image?: string;
  hero_background_image?: string;
  hero_title_main?: string;
  hero_title_highlight?: string;
  hero_subtitle?: string;
  font_h1?: string;
  font_h2?: string;
  font_body?: string;
  /** Preferred field name */
  google_fonts_url?: string;
  /** Legacy alias — still read if present */
  google_fonts_import_url?: string;
  collectionId: string;
}

export const DEFAULT_SITE_BRANDING = {
  hero_title_main: "Build Your",
  hero_title_highlight: "Perfect Japan Trip",
  hero_subtitle: "Design every detail we'll take care of the rest.",
  font_h1: "Montserrat ExtraBold",
  font_h2: "Century Gothic",
  font_body: "Poppins",
  google_fonts_url:
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@100;400;500;700;800;900&display=swap",
} as const;

export function brandingGoogleFontsUrl(b: PbSiteBranding | null): string {
  return (
    (b?.google_fonts_url || b?.google_fonts_import_url || "").trim()
  );
}

/** Default navbar logo (used until an admin uploads one in Site Branding). */
export const DEFAULT_LOGO_IMAGE = "/brand/elite-travel-logo.png";

/** Fallback Fuji/pagoda hero when no upload is set (public Unsplash). */
export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=2000&q=80";

/** Paths written by Team Access → “save to public/brand”. */
export type PublicBrandAssets = {
  hero?: string;
  logo?: string;
};

export async function fetchPublicBrandAssets(): Promise<PublicBrandAssets> {
  try {
    const base =
      typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_SITE_URL || "";
    const res = await fetch(`${base}/brand/assets.json`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    return (await res.json()) as PublicBrandAssets;
  } catch {
    return {};
  }
}

export async function fetchSiteBranding(): Promise<PbSiteBranding | null> {
  const pb = getPocketBase();
  try {
    const rows = await pb
      .collection("site_branding")
      .getFullList<PbSiteBranding>({ requestKey: null });
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export function brandingLogoUrl(
  b: PbSiteBranding | null,
  publicAssets?: PublicBrandAssets | null
): string {
  if (publicAssets?.logo) return publicAssets.logo;
  if (!b?.logo_image) return DEFAULT_LOGO_IMAGE;
  return (
    pbFileUrl(b.collectionId || "site_branding", b.id, b.logo_image) ||
    DEFAULT_LOGO_IMAGE
  );
}

export function brandingHeroUrl(
  b: PbSiteBranding | null,
  publicAssets?: PublicBrandAssets | null
): string {
  // Prefer project public asset when present (ships with the repo / VPS deploy)
  if (publicAssets?.hero) return publicAssets.hero;
  if (!b?.hero_background_image) return DEFAULT_HERO_IMAGE;
  return (
    pbFileUrl(
      b.collectionId || "site_branding",
      b.id,
      b.hero_background_image
    ) || DEFAULT_HERO_IMAGE
  );
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
  hubs: PbHub[];
  tours: PbTour[];
  transitModes: PbTransitMode[];
  seasonalHighlights: PbSeasonalHighlight[];
  seasonTiers: PbSeasonTier[];
  branding: PbSiteBranding | null;
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
    hubsRaw,
    toursRaw,
    transitModes,
    seasonalHighlightsRaw,
    seasonTiersRaw,
    brandingRows,
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
    pb
      .collection("hubs")
      .getFullList<PbHub>({ sort: "sort_order,name" })
      .catch(() => [] as PbHub[]),
    pb.collection("tours").getFullList<PbTour>({
      sort: "title",
      expand: "city_id",
    }),
    pb
      .collection("transit_modes")
      .getFullList<PbTransitMode>({ sort: "label" })
      .catch(() => [] as PbTransitMode[]),
    pb
      .collection("seasonal_highlights")
      .getFullList<PbSeasonalHighlight>({ sort: "start_month,start_day" })
      .catch(() => [] as PbSeasonalHighlight[]),
    pb
      .collection("season_tiers")
      .getFullList<PbSeasonTier>({ sort: "sort_order,month,start_day" })
      .catch(() => [] as PbSeasonTier[]),
    pb
      .collection("site_branding")
      .getFullList<PbSiteBranding>()
      .catch(() => [] as PbSiteBranding[]),
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
  const seasonalHighlights = seasonalHighlightsRaw.filter(
    (h) => h.is_active !== false
  );
  const seasonTiers = seasonTiersRaw.filter((t) => t.is_active !== false);
  const hubs = hubsRaw.filter((h) => h.is_active !== false);

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
    hubs,
    tours,
    transitModes,
    seasonalHighlights,
    seasonTiers,
    branding: brandingRows[0] ?? null,
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
