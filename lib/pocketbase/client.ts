import PocketBase, { BaseAuthStore } from "pocketbase";
import {
  calculateTourPrice,
  type TourPriceGuests,
} from "@/lib/tourPricing";

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

/** Isolated Team Access client — does not share localStorage with the public builder. */
let teamClient: PocketBase | null = null;

export function getTeamPocketBase(): PocketBase {
  const url = getPbBaseUrl();
  if (!teamClient || teamClient.baseUrl !== url) {
    // Memory-only auth store; Zustand persists the superuser token.
    // Avoids clobbering / being clobbered by the builder's `pocketbase_auth` key.
    teamClient = new PocketBase(url, new BaseAuthStore());
    teamClient.autoCancellation(false);
  }
  return teamClient;
}

export type PbFileUrlOpts = {
  /** PocketBase registered thumb size, e.g. "100x100" or "600x400" */
  thumb?: string;
  /**
   * Hint for clients/CDNs. PocketBase 0.25 ignores this, but Next.js Image
   * and future PB versions may honor it. Safe to append.
   */
  format?: "webp" | "png" | "jpeg";
};

export function pbFileUrl(
  collectionIdOrName: string,
  recordId: string,
  filename: string,
  thumbOrOpts?: string | PbFileUrlOpts
): string {
  if (!filename) return "";
  const base = `${getPbBaseUrl()}/api/files/${collectionIdOrName}/${recordId}/${encodeURIComponent(filename)}`;
  const opts: PbFileUrlOpts =
    typeof thumbOrOpts === "string"
      ? { thumb: thumbOrOpts }
      : thumbOrOpts ?? {};
  const params = new URLSearchParams();
  if (opts.thumb) params.set("thumb", opts.thumb);
  if (opts.format) params.set("format", opts.format);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

/** Prefer new field names; fall back to legacy columns during migration. */
export function cityPhoto(city: PbCity): string {
  return city.cover_photo || city.image || "";
}

export function tourPhoto(tour: PbTour): string {
  if (tourMediaType(tour) === "Video") {
    return tour.cover_photo || tour.image || "";
  }
  return tour.media_file || tour.cover_photo || tour.image || "";
}

export function tourMediaFile(tour: PbTour): string {
  return tour.media_file || tour.cover_photo || tour.image || "";
}

export function tourMediaType(tour: PbTour): "Image" | "Video" {
  const file = tourMediaFile(tour);
  // Always trust video file extensions (legacy rows often leave media_type blank)
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(file)) return "Video";
  if (tour.media_type === "Video") return "Video";
  if (tour.media_type === "Image") return "Image";
  return "Image";
}

export function tourPrice(
  tour: PbTour,
  guests: TourPriceGuests | number = 2
): number {
  return calculateTourPrice(guests, tour);
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
  /** Flat all-inclusive daily host / accompaniment rate (€) */
  base_price?: number;
  /** Multiplier applied to base_price for city difficulty / cost index */
  base_price_modifier?: number;
  /** Guided languages available in this city (Builder language dropdown). */
  available_languages?: string[];
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
  /** Optional alias of max_passengers */
  max_pax?: number;
  max_luggage?: number;
  price_per_day: number;
  vehicle_image?: string;
  /** @deprecated legacy */
  type?: string;
}

export function vehicleMaxPax(v: PbVehicle): number {
  return Number(v.max_pax ?? v.max_passengers ?? 0);
}

export function vehicleLabel(v: PbVehicle): string {
  return v.name || v.type || "Vehicle";
}

export interface PbAirportTransfer {
  id: string;
  hub_id: string;
  vehicle_id: string;
  /** Net pickup cost for this hub × vehicle (client adds 30% for max) */
  base_pickup_fee?: number;
  base_dropoff_fee?: number;
  /** @deprecated migrated to base_* */
  pickup_price_min?: number;
  pickup_price_max?: number;
  dropoff_price_min?: number;
  dropoff_price_max?: number;
  collectionId?: string;
  expand?: {
    hub_id?: PbHub;
    vehicle_id?: PbVehicle;
  };
}

export interface PbChauffeurRate {
  id: string;
  city_id: string;
  vehicle_id: string;
  /** Net full-day disposal rate (client adds 30% for max) */
  base_daily_rate: number;
  collectionId?: string;
  expand?: {
    city_id?: PbCity;
    vehicle_id?: PbVehicle;
  };
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

export interface PbCityMovement {
  id: string;
  from_city_id: string;
  to_city_id: string;
  public_transit_time_mins?: number;
  public_transit_cost?: number;
  private_transit_time_mins?: number;
  private_transit_cost?: number;
  is_recommended_order?: boolean;
  collectionId?: string;
  expand?: {
    from_city_id?: PbCity;
    to_city_id?: PbCity;
  };
}

export type FeatureExplainerKey =
  | "airport_pickup"
  | "airport_dropoff"
  | "elite_concierge"
  | (string & {});

export interface PbFeatureExplainer {
  id: string;
  feature_key: string;
  title: string;
  description?: string;
  media_type?: "Video" | "Image";
  media_file?: string;
  /** Cover image for ExplainerTriggerButton */
  thumbnail_image?: string;
  collectionId?: string;
}

export function featureExplainerMediaType(
  row: PbFeatureExplainer
): "Video" | "Image" {
  if (row.media_type === "Video") return "Video";
  if (row.media_type === "Image") return "Image";
  const file = row.media_file || "";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(file)) return "Video";
  return "Image";
}

export function featureExplainerKeysToTry(featureKey: string): string[] {
  if (
    featureKey === "airport_transfers" ||
    featureKey === "airport_transfers_combined"
  ) {
    return [
      "airport_transfers",
      "airport_transfers_combined",
      "airport_pickup",
    ];
  }
  return [featureKey];
}

export async function fetchFeatureExplainer(
  featureKey: string
): Promise<PbFeatureExplainer | null> {
  const pb = getPocketBase();
  try {
    return await pb
      .collection("feature_explainers")
      .getFirstListItem<PbFeatureExplainer>(
        pb.filter("feature_key = {:key}", { key: featureKey })
      );
  } catch {
    return null;
  }
}

/** Resolve explainer trying aliases (e.g. airport_transfers → airport_pickup). */
export async function fetchFeatureExplainerResolved(
  featureKey: string
): Promise<PbFeatureExplainer | null> {
  for (const key of featureExplainerKeysToTry(featureKey)) {
    const row = await fetchFeatureExplainer(key);
    if (row) return row;
  }
  return null;
}

export function featureExplainerThumbnailUrl(
  row: PbFeatureExplainer | null | undefined
): string {
  if (!row) return "";
  const file = row.thumbnail_image || "";
  if (!file) return "";
  return pbFileUrl(
    String(row.collectionId ?? "feature_explainers"),
    row.id,
    file,
    "800x400"
  );
}

export type BrandingUiCategory =
  | "pace"
  | "quiz_vibe"
  | "quiz_pace"
  | "quiz_crowd"
  | "concierge"
  | "matcher"
  | "planner"
  | "value"
  | "builder"
  | "pre_elite";

export interface PbBrandingUiItem {
  id: string;
  key: string;
  category: BrandingUiCategory | string;
  title?: string;
  subtitle?: string;
  description?: string;
  media?: string;
  /** Video poster / hero still */
  poster?: string;
  cta_primary?: string;
  cta_secondary?: string;
  inclusion_title?: string;
  inclusion_body?: string;
  credit_title?: string;
  credit_body?: string;
  sort_order?: number;
  collectionId?: string;
}

export async function fetchBrandingUiItems(): Promise<PbBrandingUiItem[]> {
  const pb = getPocketBase();
  try {
    return await pb.collection("branding_ui_items").getFullList<PbBrandingUiItem>({
      sort: "sort_order,key",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

export function brandingUiMediaUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  if (!row?.media || !row.id) return "";
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.media,
    thumb ? { thumb, format: "webp" } : undefined
  );
}

export function brandingUiPosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb = "600x400"
): string {
  if (!row?.poster || !row.id) return "";
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.poster,
    { thumb, format: "webp" }
  );
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
  /** `tour` = Tours tab · `activity` = Experiences tab */
  category?: "tour" | "activity" | string;
  /**
   * Matcher vibes: tours may have several; activities usually 1 primary.
   * culture | foodie | modern | nature | multi_vibe
   */
  vibe_tags?: string[];
  /** relaxed | standard | active */
  pace_tag?: string;
  /** VIP / niche — only recommended when quiz allows niche */
  is_niche?: boolean;
  /**
   * guided_route (tours) | direct_ticket | vip_event | time_sensitive
   */
  access_type?: string;
  /** hidden_gem | classic_highlight | balanced_mix */
  crowd_tag?: string;
  /** Suggested itinerary / stops */
  route?: string;
  /** What’s included and excluded */
  inclusions_exclusions?: string;
  cover_photo?: string;
  media_type?: "Image" | "Video";
  media_file?: string;
  /** Group rate for 1 passenger */
  price_1_pax?: number;
  /** Group rate for 2 passengers */
  price_2_pax?: number;
  /** Group rate for 3 passengers */
  price_3_pax?: number;
  /** Group rate for 4 passengers */
  price_4_pax?: number;
  /** Flat add-on per guest beyond 4 */
  price_extra_pax?: number;
  /**
   * Budget planner: free | low_cost | standard | luxury
   */
  pricing_tier?: "free" | "low_cost" | "standard" | "luxury" | string;
  /** Entry ticket only — no private guide package */
  is_self_guided?: boolean;
  /** When false / with is_self_guided, skip guide surcharge in budget math */
  guide_required?: boolean;
  /** Per-person ticket / landmark entry fee (EUR) for self-guided items */
  base_price_eur?: number;
  /** Optional storefront badge override */
  display_badge?: "FREE / LOW-COST" | "POPULAR" | "SELF-GUIDED" | string;
  duration_hours?: number;
  /** Guided languages offered for this experience */
  languages?: string[];
  /** Tailor-made: guest can override duration at booking time */
  is_customizable_duration?: boolean;
  /**
   * Catalog kind for Builder S / Discover Places:
   * experience (default) | place (landmark / stop)
   */
  entry_type?: "experience" | "place" | string;
  /** Google Maps coords for future routing */
  google_location?: {
    lat?: number;
    lng?: number;
    place_id?: string;
    address?: string;
  } | null;
  is_active?: boolean;
  collectionId?: string;
  /** @deprecated legacy */
  image?: string;
  /** @deprecated legacy single price — prefer tiered price_*_pax */
  price?: number;
  /** @deprecated legacy per-person */
  price_per_person?: number;
  /** @deprecated removed — prefer tiered price_*_pax */
  base_price?: number;
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
  font_h1: "Godiva-Regular",
  font_h2: "Hanson-Bold",
  font_body: "Futura-Medium",
  google_fonts_url: "",
} as const;

export function brandingGoogleFontsUrl(b: PbSiteBranding | null): string {
  return (
    (b?.google_fonts_url || b?.google_fonts_import_url || "").trim()
  );
}

/** Default navbar logo (used until an admin uploads one in Site Branding). */
export const DEFAULT_LOGO_IMAGE = "/brand/site-logo.png";

/** Fallback Chureito / Fuji hero when no upload is set (ships in public/brand). */
export const DEFAULT_HERO_IMAGE = "/brand/hero-background.jpg";

/** Paths written by Team Access → “save to public/brand”. */
export type PublicBrandAssets = {
  hero?: string;
  logo?: string;
  /** Builder S single-day hero still (Site Branding → SINGLE-DAY HERO). */
  hero_single?: string;
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
  {
    key: "elite_concierge_fee",
    value: "50",
    description:
      "Flat € design deposit for Elite Concierge (100% credited toward final trip balance on booking).",
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
  cityMovements: PbCityMovement[];
  airportTransfers: PbAirportTransfer[];
  chauffeurRates: PbChauffeurRate[];
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

/** Hotel rate matrix — ~700KB; load only when Hotels step (or print/export) needs it. */
export async function fetchAccommodations(): Promise<PbAccommodation[]> {
  return getPocketBase()
    .collection("accommodations")
    .getFullList<PbAccommodation>({ sort: "tier,room_type" });
}

export type FetchBuilderConfigOpts = {
  /**
   * Include the accommodations collection (~713KB).
   * Default false — Discover never needs it; Builder loads it on Hotels step.
   * Pass true for print / export / itinerary quote pages.
   */
  includeAccommodations?: boolean;
};

export async function fetchBuilderConfig(
  opts: FetchBuilderConfigOpts = {}
): Promise<BuilderConfig> {
  const pb = getPocketBase();
  const includeAccommodations = opts.includeAccommodations === true;

  const [
    citiesRaw,
    accommodations,
    vehicles,
    transfers,
    hubsRaw,
    toursRaw,
    transitModes,
    cityMovements,
    airportTransfers,
    chauffeurRates,
    seasonalHighlightsRaw,
    seasonTiersRaw,
    brandingRows,
    settingsRows,
    legacyRules,
  ] = await Promise.all([
    pb.collection("cities").getFullList<PbCity>({ sort: "sort_order,name" }),
    includeAccommodations
      ? fetchAccommodations()
      : Promise.resolve([] as PbAccommodation[]),
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
      .collection("city_movements")
      .getFullList<PbCityMovement>({
        sort: "from_city_id,to_city_id",
        expand: "from_city_id,to_city_id",
      })
      .catch(() => [] as PbCityMovement[]),
    pb
      .collection("airport_transfers")
      .getFullList<PbAirportTransfer>({ sort: "hub_id,vehicle_id" })
      .catch(() => [] as PbAirportTransfer[]),
    pb
      .collection("chauffeur_rates")
      .getFullList<PbChauffeurRate>({ sort: "city_id,vehicle_id" })
      .catch(() => [] as PbChauffeurRate[]),
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
    cityMovements,
    airportTransfers,
    chauffeurRates,
    seasonalHighlights,
    seasonTiers,
    branding: brandingRows[0] ?? null,
    rules,
  };
}

/** Slim catalog for Discover — cities + tours only (no hotels/rates payload). */
export interface DiscoverConfig {
  cities: PbCity[];
  tours: PbTour[];
}

/** Landmark / place rows from the parallel `experiences_and_places` collection. */
export interface PbExperienceOrPlace {
  id: string;
  title: string;
  city_id?: string;
  city_name?: string;
  type?: "experience" | "place" | string;
  duration_hours?: number;
  vibe_tags?: string[];
  description?: string;
  google_location?: {
    lat?: number;
    lng?: number;
    place_id?: string;
    address?: string;
  } | null;
  cover_photo?: string;
  is_active?: boolean;
  sort_order?: number;
  collectionId?: string;
}

/** Map EAP records into PbTour-shaped catalog items for shared UI. */
export function mapEapToTour(
  row: PbExperienceOrPlace,
  cities: PbCity[] = []
): PbTour {
  const city =
    cities.find((c) => c.id === row.city_id) ||
    cities.find(
      (c) =>
        c.name.trim().toLowerCase() ===
        String(row.city_name || "").trim().toLowerCase()
    );
  return {
    id: row.id,
    city_id: row.city_id || city?.id || "",
    title: row.title,
    description: row.description,
    category: row.type === "place" ? "place" : "activity",
    entry_type: row.type === "place" ? "place" : "experience",
    duration_hours: Number(row.duration_hours) || 0,
    vibe_tags: row.vibe_tags,
    google_location: row.google_location ?? null,
    cover_photo: row.cover_photo,
    is_active: row.is_active !== false,
    collectionId: row.collectionId,
    expand: city ? { city_id: city } : undefined,
  };
}

export async function fetchExperiencesAndPlaces(): Promise<
  PbExperienceOrPlace[]
> {
  try {
    return await getPocketBase()
      .collection("experiences_and_places")
      .getFullList<PbExperienceOrPlace>({
        sort: "sort_order,title",
        filter: "is_active != false",
      });
  } catch {
    return [];
  }
}

/** Merge tours + EAP places into one city-scoped catalog. */
export async function fetchMergedExperiencesPlacesCatalog(
  cities: PbCity[] = []
): Promise<PbTour[]> {
  const pb = getPocketBase();
  const [tours, eap] = await Promise.all([
    pb
      .collection("tours")
      .getFullList<PbTour>({ sort: "title", expand: "city_id" })
      .catch(() => [] as PbTour[]),
    fetchExperiencesAndPlaces(),
  ]);
  const fromEap = eap.map((r) => mapEapToTour(r, cities));
  const tourIds = new Set(tours.map((t) => t.id));
  return [...tours, ...fromEap.filter((r) => !tourIds.has(r.id))];
}


/** Lightweight tours list for Budget Planner (price-asc friendly). */
export async function fetchBudgetPlannerTours(): Promise<PbTour[]> {
  const pb = getPocketBase();
  // Prefer curated free/low/self-guided; fall back to full active catalog.
  try {
    const curated = await pb.collection("tours").getFullList<PbTour>({
      filter:
        "(pricing_tier = 'free' || pricing_tier = 'low_cost' || is_self_guided = true)",
      sort: "base_price_eur,price_1_pax,title",
      expand: "city_id",
    });
    const rest = await pb.collection("tours").getFullList<PbTour>({
      filter:
        "(pricing_tier != 'free' && pricing_tier != 'low_cost' && is_self_guided != true)",
      sort: "price_1_pax,title",
      expand: "city_id",
    });
    const seen = new Set(curated.map((t) => t.id));
    return [...curated, ...rest.filter((t) => !seen.has(t.id))];
  } catch {
    return pb.collection("tours").getFullList<PbTour>({
      sort: "price_1_pax,title",
      expand: "city_id",
    });
  }
}

export async function fetchDiscoverConfig(): Promise<DiscoverConfig> {
  const pb = getPocketBase();
  const [citiesRaw, toursRaw, eapRaw] = await Promise.all([
    pb.collection("cities").getFullList<PbCity>({ sort: "sort_order,name" }),
    pb.collection("tours").getFullList<PbTour>({ sort: "title" }),
    fetchExperiencesAndPlaces(),
  ]);
  const cities = citiesRaw.filter((c) => c.is_active !== false);
  const tours = toursRaw.filter((t) => t.is_active !== false);
  const fromEap = eapRaw
    .filter((r) => r.is_active !== false)
    .map((r) => mapEapToTour(r, cities));
  const ids = new Set(tours.map((t) => t.id));
  return {
    cities,
    tours: [...tours, ...fromEap.filter((r) => !ids.has(r.id))],
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
