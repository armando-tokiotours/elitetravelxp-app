import PocketBase, { BaseAuthStore } from "pocketbase";
import {
  calculateTourPrice,
  type TourPriceGuests,
} from "@/lib/tourPricing";
import {
  setSeasonalParticleRules,
  setSeasonalCharacterRules,
} from "@/lib/seasonality";

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
  // VPS / CDN pointer already stored on the record — serve as-is (no PB files proxy).
  const trimmed = String(filename).trim();
  if (
    trimmed.startsWith("/uploads/") ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return trimmed;
  }
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
  const coverUrl = String(tour.cover_url || "").trim();
  if (coverUrl) return coverUrl;
  if (tourMediaType(tour) === "Video") {
    return tour.cover_photo || tour.image || "";
  }
  return tour.media_file || tour.cover_photo || tour.image || "";
}

export function tourMediaFile(tour: PbTour): string {
  const mediaUrl = String(tour.media_url || "").trim();
  if (mediaUrl) return mediaUrl;
  return tour.media_file || tour.cover_photo || tour.image || "";
}

export function tourMediaType(tour: PbTour): "Image" | "Video" {
  const file = tourMediaFile(tour);
  // Always trust video file extensions (legacy rows often leave media_type blank)
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(file)) return "Video";
  const cover = String(tour.cover_url || tour.cover_photo || "");
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(cover)) return "Video";
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
  /** Self-arranged comparison: typical taxi/Uber hop (€). */
  avg_taxi_eur?: number;
  /** Self-arranged comparison: typical subway/day-pass (€). */
  avg_subway_day_eur?: number;
  /** Self-arranged comparison: typical wait mins. */
  taxi_wait_mins?: number;
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
  /** Optional link to transport_products (Shinkansen / Suica line item). */
  linked_transport_product_id?: string;
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
  /** Version stamp for stable /uploads/branding slots (?v= cache-buster). */
  media_version?: string;
  media?: string;
  /** Video poster / hero still · also Pre-Builder story slide 2 */
  poster?: string;
  /** Pre-Builder story slide 3 (image or video) */
  slide3?: string;
  /** Pre-Builder selected-card background (image or video) */
  card?: string;
  /** Still frame for card video (no-blink) */
  card_poster?: string;
  /** Fast preload still for slide 1 video (`media`) */
  media_poster?: string;
  /** Fast preload still for slide 2 video (`poster`) */
  slide2_poster?: string;
  /** Fast preload still for slide 3 video (`slide3`) */
  slide3_poster?: string;
  /** Card background photo (Site Branding → ICONS; JPG/WebP, 800×400px, ≤300KB) */
  icon?: string;
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
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(row.media);
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.media,
    !isVideo && thumb ? { thumb, format: "webp" } : undefined
  );
}

export function brandingUiPosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  if (!row?.poster || !row.id) return "";
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(row.poster);
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.poster,
    // No default landscape thumb — Pre-Builder story slide 2 is 9:16;
    // requesting 600x400 was cropping portraits in Team Access + stories.
    !isVideo && thumb ? { thumb, format: "webp" } : undefined
  );
}

/** Pre-Builder story slide 3 (image or video). */
export function brandingUiSlide3Url(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  if (!row?.slide3 || !row.id) return "";
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(row.slide3);
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.slide3,
    !isVideo && thumb ? { thumb, format: "webp" } : undefined
  );
}


/** Still frame for Pre-Builder card video backgrounds. */
export function brandingUiCardPosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  if (!row?.card_poster || !row.id) return "";
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.card_poster,
    thumb ? { thumb, format: "webp" } : undefined
  );
}

function brandingUiStillFileUrl(
  row: PbBrandingUiItem | null | undefined,
  fileName: string | undefined,
  thumb?: string
): string {
  if (!fileName || !row?.id) return "";
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    fileName,
    thumb ? { thumb, format: "webp" } : undefined
  );
}

/** Fast preload still for Pre-Builder story slide 1 video. */
export function brandingUiMediaPosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  return brandingUiStillFileUrl(row, row?.media_poster, thumb);
}

/** Fast preload still for Pre-Builder story slide 2 video. */
export function brandingUiSlide2PosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  return brandingUiStillFileUrl(row, row?.slide2_poster, thumb);
}

/** Fast preload still for Pre-Builder story slide 3 video. */
export function brandingUiSlide3PosterUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  return brandingUiStillFileUrl(row, row?.slide3_poster, thumb);
}

/** Uploaded icon for a branding row (Site Branding → ICONS), or "". */
export function brandingUiIconUrl(
  row: PbBrandingUiItem | null | undefined
): string {
  if (!row?.icon || !row.id) return "";
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.icon
  );
}

/** Pre-Builder selected-card background (image or video). */
export function brandingUiCardUrl(
  row: PbBrandingUiItem | null | undefined,
  thumb?: string
): string {
  if (!row?.card || !row.id) return "";
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(row.card);
  return pbFileUrl(
    String(row.collectionId ?? "branding_ui_items"),
    row.id,
    row.card,
    !isVideo && thumb ? { thumb, format: "webp" } : undefined
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
  /** Who can book: agency | individual | both (default both) */
  audience?: "agency" | "individual" | "both" | string;
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
   * Agent-only bonus gift — hidden from guest catalog until Ops
   * adds it to the guest package / invoice.
   */
  is_bonus?: boolean;
  /**
   * guided_route | direct_ticket (buy before) | admission (on-site) |
   * vip_event | time_sensitive
   */
  access_type?: string;
  /** hidden_gem | classic_highlight | balanced_mix */
  crowd_tag?: string;
  /** Suggested itinerary / stops */
  route?: string;
  /** What’s included and excluded */
  inclusions_exclusions?: string;
  cover_photo?: string;
  /** VPS/CDN public path e.g. /uploads/catalog/... — preferred over cover_photo */
  cover_url?: string;
  media_type?: "Image" | "Video";
  media_file?: string;
  /** VPS/CDN public path for video/gallery media */
  media_url?: string;
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
  /** Tour family: id of the master tour (master points to itself). */
  family_id?: string;
  /** True on the family master row (owns title/story/photo). */
  is_family_master?: boolean;
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

/** Guest storefront / builders — active and not agent-only bonus gifts. */
export function isGuestCatalogTour(t: {
  is_active?: boolean;
  is_bonus?: boolean;
}): boolean {
  return t.is_active !== false && !t.is_bonus;
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

/** Ambient FX windows — Team Access → Seasonality → Particles */
export interface PbSeasonalParticle {
  id: string;
  season: "sakura" | "snow" | "momiji";
  label: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
  collectionId: string;
}

/** Climate mascots — Team Access → Seasonality → Characters */
export type ClimateSeasonKey = "default" | "winter" | "summer" | "rain";

export interface PbSeasonalCharacter {
  id: string;
  key: ClimateSeasonKey;
  label: string;
  start_month?: number;
  start_day?: number;
  end_month?: number;
  end_day?: number;
  mascot?: string;
  sort_order?: number;
  is_active?: boolean;
  collectionId: string;
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
  /** Browser tab / OG title (Team Brand Configuration) */
  document_title?: string;
  /** Meta description under the tab title */
  document_description?: string;
  font_h1?: string;
  font_h2?: string;
  font_body?: string;
  /** Preferred field name */
  google_fonts_url?: string;
  /** Legacy alias — still read if present */
  google_fonts_import_url?: string;
  /** Concierge estimate / €60 fee flow (admin-editable) */
  estimate_modal_title?: string;
  estimate_per_day_subtext?: string;
  concierge_fee_amount?: string;
  concierge_fee_policy_text?: string;
  concierge_fee_modal_title?: string;
  revolut_payment_url?: string;
  estimate_opt_full_title?: string;
  estimate_opt_full_sub?: string;
  estimate_opt_partial_title?: string;
  estimate_opt_partial_sub?: string;
  estimate_opt_later_title?: string;
  estimate_opt_later_sub?: string;
  /** Builder E attractions hero widget */
  attractions_widget_title?: string;
  attractions_widget_subtitle?: string;
  attractions_widget_bg?: string;
  /** Homepage Torii portal carousel */
  torii_multiday_frame?: string;
  torii_multiday_image?: string;
  torii_single_frame?: string;
  torii_single_image?: string;
  torii_builder_e_frame?: string;
  torii_builder_e_image?: string;
  /** Scale factor as text, e.g. "1.0" … "1.5" */
  torii_gate_scale?: string;
  torii_orientation?: "HORIZONTAL" | "VERTICAL" | string;
  /** Per-gate portal mask alignment (text %, e.g. "0", "80") */
  torii_multiday_mask_x?: string;
  torii_multiday_mask_y?: string;
  torii_multiday_mask_w?: string;
  torii_multiday_mask_h?: string;
  torii_single_mask_x?: string;
  torii_single_mask_y?: string;
  torii_single_mask_w?: string;
  torii_single_mask_h?: string;
  torii_builder_e_mask_x?: string;
  torii_builder_e_mask_y?: string;
  torii_builder_e_mask_w?: string;
  torii_builder_e_mask_h?: string;
  /** Homepage linear poster cards (JSON config + cover files) */
  hero_intro_config?: string;
  hero_card_single_photo?: string;
  hero_card_experience_photo?: string;
  hero_card_multiday_photo?: string;
  /** Per-card uploaded accordion video (Media = Video Upload, mp4/webm ≤50MB) */
  hero_card_single_video?: string;
  hero_card_experience_video?: string;
  hero_card_multiday_video?: string;
  /** Hero grid panels p1–p6 uploaded media (migration 1791310000) */
  hero_panel_p1_image?: string;
  hero_panel_p2_image?: string;
  hero_panel_p3_image?: string;
  hero_panel_p4_image?: string;
  hero_panel_p5_image?: string;
  hero_panel_p6_image?: string;
  hero_panel_p1_video?: string;
  hero_panel_p2_video?: string;
  hero_panel_p3_video?: string;
  hero_panel_p4_video?: string;
  hero_panel_p5_video?: string;
  hero_panel_p6_video?: string;
  collectionId: string;
}

export const DEFAULT_SITE_BRANDING = {
  hero_title_main: "Build Your",
  hero_title_highlight: "Perfect Japan Trip",
  hero_subtitle: "Design every detail we'll take care of the rest.",
  document_title: "Tokiotours — Japan Journey Architect",
  document_description:
    "Custom 1-Day Highlights & Grand Bespoke Japan Vacation Builder",
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

/** Empty = plain grey hero plane (never logo filler in empty slots). */
export const DEFAULT_HERO_IMAGE = "";

/** Paths written by Team Access → “save to public/brand”. */
export type PublicBrandAssets = {
  hero?: string;
  logo?: string;
  /** Builder S single-day hero still (Site Branding → SINGLE-DAY HERO). */
  hero_single?: string;
  /** Browser tab / favicon. */
  favicon?: string;
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

/** Builder E attractions hero banner background. */
export function brandingAttractionsWidgetUrl(
  b: PbSiteBranding | null
): string {
  if (b?.attractions_widget_bg) {
    return (
      pbFileUrl(
        b.collectionId || "site_branding",
        b.id,
        b.attractions_widget_bg
      ) || ""
    );
  }
  return "";
}

export type ToriiPortalGateId = "multiday" | "single" | "experience";

export type ToriiPortalGateLayout = {
  frameUrl: string;
  imageUrl: string;
  /** Photo X offset % (−30…30) */
  photoOffsetX: number;
  /** Photo Y offset % (−30…30) */
  photoOffsetY: number;
  /** Portal window width % of gate (50…100) */
  maskWidth: number;
  /** Portal window height % of gate (50…100) */
  maskHeight: number;
};

export type ToriiPortalBranding = {
  orientation: "HORIZONTAL" | "VERTICAL";
  gateScale: number;
  gates: Record<ToriiPortalGateId, ToriiPortalGateLayout>;
};

export const DEFAULT_TORII_FRAMES: Record<ToriiPortalGateId, string> = {
  multiday: "/images/Tori-1.png",
  single: "/images/tori-3.png",
  experience: "/images/tori-2.png",
};

export const DEFAULT_TORII_IMAGES: Record<ToriiPortalGateId, string> = {
  multiday: "",
  single: "",
  experience: "",
};

export const DEFAULT_TORII_GATE_LAYOUT: Omit<
  ToriiPortalGateLayout,
  "frameUrl" | "imageUrl"
> = {
  photoOffsetX: 0,
  photoOffsetY: 0,
  maskWidth: 80,
  maskHeight: 85,
};

function brandingFileOrFallback(
  b: PbSiteBranding | null,
  field: keyof PbSiteBranding,
  fallback: string
): string {
  const name = b ? String(b[field] || "").trim() : "";
  if (!b || !name) return fallback;
  return (
    pbFileUrl(b.collectionId || "site_branding", b.id, name) || fallback
  );
}

function clampToriiNum(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function resolveGateLayout(
  b: PbSiteBranding | null,
  id: ToriiPortalGateId,
  pbGate: "multiday" | "single" | "builder_e"
): ToriiPortalGateLayout {
  return {
    frameUrl: brandingFileOrFallback(
      b,
      `torii_${pbGate}_frame` as keyof PbSiteBranding,
      DEFAULT_TORII_FRAMES[id]
    ),
    imageUrl: brandingFileOrFallback(
      b,
      `torii_${pbGate}_image` as keyof PbSiteBranding,
      DEFAULT_TORII_IMAGES[id]
    ),
    photoOffsetX: clampToriiNum(
      b?.[`torii_${pbGate}_mask_x` as keyof PbSiteBranding],
      DEFAULT_TORII_GATE_LAYOUT.photoOffsetX,
      -30,
      30
    ),
    photoOffsetY: clampToriiNum(
      b?.[`torii_${pbGate}_mask_y` as keyof PbSiteBranding],
      DEFAULT_TORII_GATE_LAYOUT.photoOffsetY,
      -30,
      30
    ),
    maskWidth: clampToriiNum(
      b?.[`torii_${pbGate}_mask_w` as keyof PbSiteBranding],
      DEFAULT_TORII_GATE_LAYOUT.maskWidth,
      50,
      100
    ),
    maskHeight: clampToriiNum(
      b?.[`torii_${pbGate}_mask_h` as keyof PbSiteBranding],
      DEFAULT_TORII_GATE_LAYOUT.maskHeight,
      50,
      100
    ),
  };
}

export function resolveToriiPortalBranding(
  b: PbSiteBranding | null
): ToriiPortalBranding {
  const scaleRaw = Number(String(b?.torii_gate_scale || "1").trim());
  const gateScale =
    Number.isFinite(scaleRaw) && scaleRaw > 0
      ? Math.min(1.75, Math.max(0.7, scaleRaw))
      : 1;
  const orientation =
    String(b?.torii_orientation || "HORIZONTAL").toUpperCase() === "VERTICAL"
      ? "VERTICAL"
      : "HORIZONTAL";

  return {
    orientation,
    gateScale,
    gates: {
      multiday: resolveGateLayout(b, "multiday", "multiday"),
      single: resolveGateLayout(b, "single", "single"),
      experience: resolveGateLayout(b, "experience", "builder_e"),
    },
  };
}

export type HomepageHeroCardId = "single" | "experience" | "multiday";

/** @deprecated Prefer overlay.left/top — kept for older saved JSON */
export type HomepageHeroJpPosition =
  | "top-right"
  | "bottom-center"
  | "top-left";

export type HomepageHeroTextRole = "h1" | "h2" | "body";
export type HomepageHeroTextOrientation = "horizontal" | "vertical";

export type HomepageHeroTextSlot = {
  left: number;
  top: number;
  maxWidth: number;
  /** Relative font scale % (20–220) */
  fontSize: number;
  role: HomepageHeroTextRole;
  orientation: HomepageHeroTextOrientation;
};

export type HomepageHeroOverlayLayout = {
  left: number;
  top: number;
  fontSize: number;
  role: HomepageHeroTextRole;
  orientation: HomepageHeroTextOrientation;
};

export type HomepageHeroCardMediaType = "image" | "video" | "youtube_link";

export type HomepageHeroCardConfig = {
  id: HomepageHeroCardId;
  title: string;
  subtitle: string;
  japaneseText: string;
  /** @deprecated mapped from overlay when missing */
  japaneseTextPosition: HomepageHeroJpPosition;
  overlay: HomepageHeroOverlayLayout;
  heroPhotoUrl: string;
  /** Cache-buster for stable-slot heroPhotoUrl (JSON only). */
  heroPhotoVersion?: string;
  /** Accordion media kind; unset/"image" = legacy photo behaviour. */
  mediaType?: HomepageHeroCardMediaType;
  /** Uploaded video file URL (site_branding hero_card_{id}_video), like heroPhotoUrl. */
  mediaVideoUrl?: string;
  /** External YouTube/Vimeo/direct-mp4 URL as entered by admin; normalized at render. */
  mediaEmbedUrl?: string;
  route: string;
  order: number;
  tripType?: "multi_day" | "single_day";
};

export type ParsedVideoEmbed =
  | { provider: "youtube"; id: string; embedUrl: string }
  | { provider: "vimeo"; id: string; embedUrl: string }
  | { provider: "file"; id: string; embedUrl: string };

/**
 * Parse a YouTube / Vimeo / direct-mp4 URL into an autoplay embed URL.
 * Accepts watch, youtu.be, embed, shorts and live YouTube forms,
 * vimeo.com/<id> and player.vimeo.com/video/<id>, and .mp4/.webm files.
 * Embed URLs are built at render time (not stored), so old saved raw
 * URLs keep working unchanged. Returns null for anything unrecognized.
 */
export function parseVideoEmbed(raw: string | undefined | null): ParsedVideoEmbed | null {
  const url = String(raw || "").trim();
  if (!url) return null;
  if (/\.(mp4|webm)(\?|#|$)/i.test(url)) {
    return { provider: "file", id: url, embedUrl: url };
  }
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i) ||
    url.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
  if (yt) {
    const id = yt[1];
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0`,
    };
  }
  const vm =
    url.match(/player\.vimeo\.com\/video\/(\d+)/i) ||
    url.match(/vimeo\.com\/(\d+)/i);
  if (vm) {
    const id = vm[1];
    return {
      provider: "vimeo",
      id,
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&controls=0&playsinline=1&background=1`,
    };
  }
  return null;
}

export function parseHomepageHeroMediaType(raw: unknown): HomepageHeroCardMediaType {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "video" || v === "youtube_link") return v;
  return "image";
}

export type HomepageHeroIntroTextId =
  | "mainTitle"
  | "scriptTitle"
  | "tagline";

export type HomepageHeroGridPanelId = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";

export const HOMEPAGE_HERO_GRID_PANEL_IDS: HomepageHeroGridPanelId[] = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
];

export type HomepageHeroGridPanelMedia = {
  mediaType: HomepageHeroCardMediaType;
  /** External YouTube/Vimeo/direct-mp4 URL as entered by admin. */
  mediaEmbedUrl: string;
  /**
   * Resolved uploaded-image URL. New uploads live OUTSIDE PocketBase in a
   * stable per-panel slot (/uploads/hero-panels/hero-panel-p{n}.…) and the
   * bare URL is stored in hero_intro_config JSON; a `?v=` cache-buster is
   * appended at resolve/display time only. Legacy panels fall back to the
   * PocketBase `hero_panel_p{n}_image` file field. "" = built-in artwork.
   */
  mediaImageUrl: string;
  /** Resolved uploaded-video URL (same storage scheme as mediaImageUrl). */
  mediaVideoUrl: string;
  /** Cache-buster stored beside mediaImageUrl in JSON (not part of the URL). */
  mediaImageVersion?: string;
  /** Cache-buster stored beside mediaVideoUrl in JSON (not part of the URL). */
  mediaVideoVersion?: string;
};

export function defaultHomepageHeroGridPanels(): Record<
  HomepageHeroGridPanelId,
  HomepageHeroGridPanelMedia
> {
  const blank = (): HomepageHeroGridPanelMedia => ({
    mediaType: "image",
    mediaEmbedUrl: "",
    mediaImageUrl: "",
    mediaVideoUrl: "",
  });
  return { p1: blank(), p2: blank(), p3: blank(), p4: blank(), p5: blank(), p6: blank() };
}

export type HomepageHeroIntroBranding = {
  mainTitle: string;
  scriptTitle: string;
  tagline: string;
  /** Purple grid panel background (hex). Admin-driven, default #9333EA. */
  panelColor: string;
  /** Purple grid panel text. Empty = derived from scriptTitle headline. */
  panelText: string;
  textLayouts: Record<HomepageHeroIntroTextId, HomepageHeroTextSlot>;
  cards: HomepageHeroCardConfig[];
  gridPanels: Record<HomepageHeroGridPanelId, HomepageHeroGridPanelMedia>;
};

export const DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS: Record<
  HomepageHeroIntroTextId,
  HomepageHeroTextSlot
> = {
  scriptTitle: {
    left: 4,
    top: 4,
    maxWidth: 40,
    fontSize: 165,
    role: "h1",
    orientation: "horizontal",
  },
  mainTitle: {
    left: 4,
    top: 16,
    maxWidth: 72,
    fontSize: 100,
    role: "h1",
    orientation: "horizontal",
  },
  tagline: {
    left: 4,
    top: 58, // below H1 “IN 60 SECONDS”
    maxWidth: 58,
    fontSize: 90,
    role: "body",
    orientation: "horizontal",
  },
};

/** Legacy single-block layout — still accepted when reading old JSON */
export const DEFAULT_HOMEPAGE_HERO_TEXT_LAYOUT = {
  left: 4,
  top: 14,
  maxWidth: 48,
};

export const DEFAULT_HOMEPAGE_HERO_OVERLAY: HomepageHeroOverlayLayout = {
  left: 62,
  top: 6,
  fontSize: 90,
  role: "body",
  orientation: "horizontal",
};

const DEFAULT_OVERLAY_BY_CARD: Record<
  HomepageHeroCardId,
  HomepageHeroOverlayLayout
> = {
  single: { left: 58, top: 6, fontSize: 90, role: "body", orientation: "horizontal" },
  experience: {
    left: 20,
    top: 78,
    fontSize: 90,
    role: "body",
    orientation: "horizontal",
  },
  multiday: { left: 8, top: 6, fontSize: 90, role: "body", orientation: "horizontal" },
};

function jpPresetToOverlay(
  pos: HomepageHeroJpPosition,
  fallback: HomepageHeroOverlayLayout
): HomepageHeroOverlayLayout {
  if (pos === "bottom-center") {
    return { ...fallback, left: 20, top: 78 };
  }
  if (pos === "top-left") {
    return { ...fallback, left: 8, top: 6 };
  }
  return { ...fallback, left: 58, top: 6 };
}

function overlayToJpPreset(o: HomepageHeroOverlayLayout): HomepageHeroJpPosition {
  if (o.top >= 60) return "bottom-center";
  if (o.left < 35) return "top-left";
  return "top-right";
}

const DEFAULT_HERO_CARD_META: Record<
  HomepageHeroCardId,
  Omit<HomepageHeroCardConfig, "heroPhotoUrl"> & { defaultPhoto: string }
> = {
  single: {
    id: "single",
    title: "1-Day Express Pass",
    subtitle: "Custom 1-Day Private Route & Instant Quote",
    japaneseText: "一日",
    japaneseTextPosition: "top-right",
    overlay: { ...DEFAULT_OVERLAY_BY_CARD.single },
    route: "/pre-elite-builder?type=single",
    order: 1,
    tripType: "single_day",
    defaultPhoto: "",
  },
  experience: {
    id: "experience",
    title: "VIP Tickets & Local Access",
    subtitle: "Hard-to-get tickets, restaurant reservations & local specs",
    japaneseText: "体験",
    japaneseTextPosition: "bottom-center",
    overlay: { ...DEFAULT_OVERLAY_BY_CARD.experience },
    route: "/builder/vip-access",
    order: 2,
    defaultPhoto: "",
  },
  multiday: {
    id: "multiday",
    title: "Grand Japan Journey",
    subtitle: "Full Bespoke Vacation across Tokyo, Kyoto & Beyond",
    japaneseText: "旅",
    japaneseTextPosition: "top-left",
    overlay: { ...DEFAULT_OVERLAY_BY_CARD.multiday },
    route: "/pre-elite-builder?type=multiday",
    order: 3,
    tripType: "multi_day",
    defaultPhoto: "",
  },
};

export const DEFAULT_HOMEPAGE_HERO_INTRO: HomepageHeroIntroBranding = {
  // Order on page: 1) highlight  2) main H1  3) supporting
  mainTitle: "YOUR DREAM JAPAN TRIP\nIN 60 SECONDS",
  scriptTitle: "DESIGN",
  panelColor: "#9333EA",
  panelText: "",
  tagline:
    "Tap what you love—secret food spots, private day tours, or exclusive Japan tickets—and build your bespoke VIP experience instantly.",
  textLayouts: {
    mainTitle: { ...DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.mainTitle },
    scriptTitle: { ...DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.scriptTitle },
    tagline: { ...DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.tagline },
  },
  cards: (["single", "experience", "multiday"] as HomepageHeroCardId[]).map(
    (id) => {
      const m = DEFAULT_HERO_CARD_META[id];
      return {
        id: m.id,
        title: m.title,
        subtitle: m.subtitle,
        japaneseText: m.japaneseText,
        japaneseTextPosition: m.japaneseTextPosition,
        overlay: { ...m.overlay },
        heroPhotoUrl: m.defaultPhoto,
        mediaType: "image",
        mediaVideoUrl: "",
        mediaEmbedUrl: "",
        route: m.route,
        order: m.order,
        tripType: m.tripType,
      };
    }
  ),
  gridPanels: defaultHomepageHeroGridPanels(),
};

type HeroIntroJson = {
  mainTitle?: string;
  scriptTitle?: string;
  tagline?: string;
  panelColor?: string;
  panelText?: string;
  /** legacy single block */
  textLayout?: Partial<{ left: number; top: number; maxWidth: number }>;
  textLayouts?: Partial<
    Record<HomepageHeroIntroTextId, Partial<HomepageHeroTextSlot>>
  >;
  cards?: Partial<
    Record<
      HomepageHeroCardId,
      {
        title?: string;
        subtitle?: string;
        japaneseText?: string;
        japaneseTextPosition?: string;
        order?: number;
        overlay?: Partial<HomepageHeroOverlayLayout>;
        mediaType?: string;
        mediaEmbedUrl?: string;
        /** Stable external slot URL (/uploads/branding/home-card-…) */
        heroPhotoUrl?: string;
        heroPhotoVersion?: string;
      }
    >
  >;
  gridPanels?: Partial<
    Record<
      HomepageHeroGridPanelId,
      {
        mediaType?: string;
        mediaEmbedUrl?: string;
        mediaImageUrl?: string;
        mediaVideoUrl?: string;
        mediaImageVersion?: string;
        mediaVideoVersion?: string;
      }
    >
  >;
};

/**
 * Split a panel media URL into its bare stored reference + cache-buster.
 * Only external-storage URLs (/uploads/…) and absolute http(s) URLs are
 * persistable in JSON; blob:/data: previews and PocketBase file URLs are
 * NOT stored (PB files keep resolving via the legacy file-field fallback).
 */
function splitPanelMediaUrl(raw: unknown): { url: string; version: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed || /^(blob:|data:)/i.test(trimmed)) return { url: "", version: "" };
  let url = trimmed;
  let version = "";
  try {
    const parsed = new URL(trimmed, "http://local.invalid");
    version = String(parsed.searchParams.get("v") || "").trim();
    parsed.searchParams.delete("v");
    const qs = parsed.searchParams.toString();
    url =
      parsed.origin === "http://local.invalid"
        ? `${parsed.pathname}${qs ? `?${qs}` : ""}${parsed.hash}`
        : parsed.toString();
  } catch {
    /* keep raw */
  }
  if (!url.startsWith("/uploads/") && !/^https?:\/\//i.test(url)) {
    return { url: "", version: "" };
  }
  // PocketBase file URLs must not be baked into JSON — the file-field
  // fallback in resolveHomepageHeroIntro owns those.
  if (/\/api\/files\//i.test(url)) return { url: "", version: "" };
  return { url, version };
}

/** Append the stored cache-buster at display time (stored URL stays bare). */
function withMediaVersion(url: string, version: string | undefined): string {
  const u = String(url || "").trim();
  const v = String(version || "").trim();
  if (!u || !v) return u;
  return `${u}${u.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
}

function parseHeroJpPosition(raw: unknown): HomepageHeroJpPosition {
  const v = String(raw || "").trim();
  if (v === "bottom-center" || v === "top-left" || v === "top-right") return v;
  return "top-right";
}

function clampHeroLayoutNum(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

function parseTextRole(raw: unknown, fallback: HomepageHeroTextRole): HomepageHeroTextRole {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "h1" || v === "h2" || v === "body") return v;
  return fallback;
}

function parseOrientation(
  raw: unknown,
  fallback: HomepageHeroTextOrientation
): HomepageHeroTextOrientation {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "vertical" || v === "horizontal") return v;
  return fallback;
}

function mergeTextSlot(
  base: HomepageHeroTextSlot,
  raw: unknown
): HomepageHeroTextSlot {
  if (!raw || typeof raw !== "object") return { ...base };
  const o = raw as Record<string, unknown>;
  return {
    left: clampHeroLayoutNum(o.left, base.left, 0, 90),
    top: clampHeroLayoutNum(o.top, base.top, 0, 90),
    maxWidth: clampHeroLayoutNum(o.maxWidth, base.maxWidth, 10, 100),
    fontSize: clampHeroLayoutNum(o.fontSize, base.fontSize, 20, 220),
    role: parseTextRole(o.role, base.role),
    orientation: parseOrientation(o.orientation, base.orientation),
  };
}

function mergeOverlay(
  base: HomepageHeroOverlayLayout,
  raw: unknown,
  jpPos?: HomepageHeroJpPosition
): HomepageHeroOverlayLayout {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      left: clampHeroLayoutNum(o.left, base.left, 0, 90),
      top: clampHeroLayoutNum(o.top, base.top, 0, 90),
      fontSize: clampHeroLayoutNum(o.fontSize, base.fontSize, 20, 220),
      role: parseTextRole(o.role, base.role),
      orientation: parseOrientation(o.orientation, base.orientation),
    };
  }
  if (jpPos) return jpPresetToOverlay(jpPos, base);
  return { ...base };
}

function resolveTextLayouts(
  parsed: HeroIntroJson
): Record<HomepageHeroIntroTextId, HomepageHeroTextSlot> {
  const legacy = parsed.textLayout;
  const fromLegacy = (id: HomepageHeroIntroTextId): HomepageHeroTextSlot => {
    const base = DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS[id];
    if (!legacy) return { ...base };
    // Old single block → seed all three near that position with offsets
    const offset = id === "mainTitle" ? 0 : id === "scriptTitle" ? 8 : 18;
    return mergeTextSlot(base, {
      left: legacy.left ?? base.left,
      top: (legacy.top ?? base.top) + offset * 0.35,
      maxWidth: legacy.maxWidth ?? base.maxWidth,
    });
  };

  return {
    mainTitle: mergeTextSlot(
      fromLegacy("mainTitle"),
      parsed.textLayouts?.mainTitle
    ),
    scriptTitle: mergeTextSlot(
      fromLegacy("scriptTitle"),
      parsed.textLayouts?.scriptTitle
    ),
    tagline: mergeTextSlot(fromLegacy("tagline"), parsed.textLayouts?.tagline),
  };
}

export function heroTextRoleClass(role: HomepageHeroTextRole): string {
  if (role === "h1") return "font-godiva tracking-wide uppercase";
  if (role === "h2") return "font-hanson tracking-wide";
  return "font-futura font-light leading-relaxed";
}

export function heroTextOrientationStyle(
  orientation: HomepageHeroTextOrientation
): { writingMode?: "vertical-rl"; textOrientation?: "mixed" } {
  if (orientation === "vertical") {
    return {
      writingMode: "vertical-rl",
      textOrientation: "mixed",
    };
  }
  return {};
}

export function resolveHomepageHeroIntro(
  b: PbSiteBranding | null
): HomepageHeroIntroBranding {
  let parsed: HeroIntroJson = {};
  try {
    const raw = String(b?.hero_intro_config || "").trim();
    if (raw) parsed = JSON.parse(raw) as HeroIntroJson;
  } catch {
    parsed = {};
  }

  const photoField: Record<HomepageHeroCardId, keyof PbSiteBranding> = {
    single: "hero_card_single_photo",
    experience: "hero_card_experience_photo",
    multiday: "hero_card_multiday_photo",
  };

  const videoField: Record<HomepageHeroCardId, keyof PbSiteBranding> = {
    single: "hero_card_single_video",
    experience: "hero_card_experience_video",
    multiday: "hero_card_multiday_video",
  };

  const cards: HomepageHeroCardConfig[] = (
    ["single", "experience", "multiday"] as HomepageHeroCardId[]
  ).map((id) => {
    const meta = DEFAULT_HERO_CARD_META[id];
    const override = parsed.cards?.[id] || {};
    const orderRaw = Number(override.order);
    const jpPos = parseHeroJpPosition(
      override.japaneseTextPosition || meta.japaneseTextPosition
    );
    const overlay = mergeOverlay(
      meta.overlay,
      override.overlay,
      override.overlay ? undefined : jpPos
    );
    return {
      id,
      title: String(override.title || meta.title).trim() || meta.title,
      subtitle:
        String(override.subtitle ?? meta.subtitle).trim() || meta.subtitle,
      japaneseText:
        String(override.japaneseText || meta.japaneseText).trim() ||
        meta.japaneseText,
      japaneseTextPosition: overlayToJpPreset(overlay),
      overlay,
      heroPhotoUrl: (() => {
        const jsonPhoto = splitPanelMediaUrl(override.heroPhotoUrl);
        // Preferred: stable external slot stored in JSON. Legacy
        // PocketBase file field still resolves until re-uploaded.
        return jsonPhoto.url
          ? withMediaVersion(
              jsonPhoto.url,
              String(override.heroPhotoVersion || "").trim() ||
                jsonPhoto.version
            )
          : brandingFileOrFallback(b, photoField[id], meta.defaultPhoto);
      })(),
      heroPhotoVersion:
        String(override.heroPhotoVersion || "").trim() ||
        splitPanelMediaUrl(override.heroPhotoUrl).version,
      mediaType: parseHomepageHeroMediaType(override.mediaType),
      mediaVideoUrl: brandingFileOrFallback(b, videoField[id], ""),
      mediaEmbedUrl: String(override.mediaEmbedUrl || "").trim(),
      route: meta.route,
      order:
        Number.isFinite(orderRaw) && orderRaw >= 1 && orderRaw <= 3
          ? Math.round(orderRaw)
          : meta.order,
      tripType: meta.tripType,
    };
  });

  // Use nullish checks so a temporary "" while editing is NOT replaced with
  // the previous default (that was wiping the Main Intro fields on autosave).
  const pickCopy = (raw: unknown, fallback: string) => {
    if (raw === undefined || raw === null) return fallback;
    return String(raw);
  };

  const gridPanels = defaultHomepageHeroGridPanels();
  for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
    const override = parsed.gridPanels?.[id] || {};
    // Preferred: external-storage URL stored in JSON (stable /uploads/…
    // slot). Backward compat: legacy PocketBase file fields still resolve.
    const jsonImage = splitPanelMediaUrl(override.mediaImageUrl);
    const jsonVideo = splitPanelMediaUrl(override.mediaVideoUrl);
    const imageVersion =
      String(override.mediaImageVersion || "").trim() || jsonImage.version;
    const videoVersion =
      String(override.mediaVideoVersion || "").trim() || jsonVideo.version;
    gridPanels[id] = {
      mediaType: parseHomepageHeroMediaType(override.mediaType),
      mediaEmbedUrl: String(override.mediaEmbedUrl || "").trim(),
      mediaImageUrl: jsonImage.url
        ? withMediaVersion(jsonImage.url, imageVersion)
        : brandingFileOrFallback(
            b,
            `hero_panel_${id}_image` as keyof PbSiteBranding,
            ""
          ),
      mediaVideoUrl: jsonVideo.url
        ? withMediaVersion(jsonVideo.url, videoVersion)
        : brandingFileOrFallback(
            b,
            `hero_panel_${id}_video` as keyof PbSiteBranding,
            ""
          ),
      mediaImageVersion: imageVersion,
      mediaVideoVersion: videoVersion,
    };
  }

  return {
    mainTitle: pickCopy(parsed.mainTitle, DEFAULT_HOMEPAGE_HERO_INTRO.mainTitle),
    scriptTitle: pickCopy(
      parsed.scriptTitle,
      DEFAULT_HOMEPAGE_HERO_INTRO.scriptTitle
    ),
    tagline: pickCopy(parsed.tagline, DEFAULT_HOMEPAGE_HERO_INTRO.tagline),
    panelColor: /^#[0-9a-fA-F]{6}$/.test(String(parsed.panelColor || "").trim())
      ? String(parsed.panelColor).trim()
      : DEFAULT_HOMEPAGE_HERO_INTRO.panelColor,
    panelText: String(parsed.panelText ?? "").trim(),
    textLayouts: resolveTextLayouts(parsed),
    cards,
    gridPanels,
  };
}

export function serializeHomepageHeroIntroConfig(input: {
  mainTitle: string;
  scriptTitle: string;
  tagline: string;
  panelColor?: string;
  panelText?: string;
  textLayouts: Record<HomepageHeroIntroTextId, HomepageHeroTextSlot>;
  cards: Pick<
    HomepageHeroCardConfig,
    | "id"
    | "title"
    | "subtitle"
    | "japaneseText"
    | "japaneseTextPosition"
    | "overlay"
    | "order"
    | "mediaType"
    | "mediaEmbedUrl"
    | "heroPhotoUrl"
    | "heroPhotoVersion"
  >[];
  gridPanels?: Partial<
    Record<
      HomepageHeroGridPanelId,
      Pick<
        HomepageHeroGridPanelMedia,
        | "mediaType"
        | "mediaEmbedUrl"
        | "mediaImageUrl"
        | "mediaVideoUrl"
        | "mediaImageVersion"
        | "mediaVideoVersion"
      >
    >
  >;
}): string {
  const gridPanels: HeroIntroJson["gridPanels"] = {};
  for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
    const p = input.gridPanels?.[id];
    const image = splitPanelMediaUrl(p?.mediaImageUrl);
    const video = splitPanelMediaUrl(p?.mediaVideoUrl);
    gridPanels[id] = {
      // Only bare external-storage URLs (/uploads/…) are serialized —
      // never image bytes, blob previews, or PocketBase file URLs (legacy
      // PB-file panels keep resolving via the file-field fallback).
      mediaType: parseHomepageHeroMediaType(p?.mediaType),
      mediaEmbedUrl: String(p?.mediaEmbedUrl || "").trim(),
      mediaImageUrl: image.url,
      mediaVideoUrl: video.url,
      mediaImageVersion:
        String(p?.mediaImageVersion || "").trim() || image.version,
      mediaVideoVersion:
        String(p?.mediaVideoVersion || "").trim() || video.version,
    };
  }
  const cards: HeroIntroJson["cards"] = {};
  for (const c of input.cards) {
    const photo = splitPanelMediaUrl(c.heroPhotoUrl);
    cards[c.id] = {
      title: c.title,
      subtitle: c.subtitle,
      japaneseText: c.japaneseText,
      japaneseTextPosition: overlayToJpPreset(c.overlay),
      order: c.order,
      overlay: mergeOverlay(DEFAULT_HOMEPAGE_HERO_OVERLAY, c.overlay),
      // Raw URL as entered; render normalizes via parseVideoEmbed.
      mediaType: parseHomepageHeroMediaType(c.mediaType),
      mediaEmbedUrl: String(c.mediaEmbedUrl || "").trim(),
      // Only bare external-storage URLs (/uploads/…) — never blob or
      // PocketBase file URLs (legacy PB photos keep the field fallback).
      heroPhotoUrl: photo.url,
      heroPhotoVersion:
        String(c.heroPhotoVersion || "").trim() || photo.version,
    };
  }
  return JSON.stringify({
    mainTitle: input.mainTitle,
    scriptTitle: input.scriptTitle,
    tagline: input.tagline,
    panelColor: /^#[0-9a-fA-F]{6}$/.test(String(input.panelColor || "").trim())
      ? String(input.panelColor).trim()
      : DEFAULT_HOMEPAGE_HERO_INTRO.panelColor,
    panelText: String(input.panelText ?? "").trim(),
    textLayouts: {
      mainTitle: mergeTextSlot(
        DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.mainTitle,
        input.textLayouts.mainTitle
      ),
      scriptTitle: mergeTextSlot(
        DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.scriptTitle,
        input.textLayouts.scriptTitle
      ),
      tagline: mergeTextSlot(
        DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS.tagline,
        input.textLayouts.tagline
      ),
    },
    cards,
    gridPanels,
  });
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
  seasonalParticles: PbSeasonalParticle[];
  seasonalCharacters: PbSeasonalCharacter[];
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
    seasonalParticlesRaw,
    seasonalCharactersRaw,
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
      .collection("seasonal_particles")
      .getFullList<PbSeasonalParticle>({
        sort: "sort_order,start_month,start_day",
      })
      .catch(() => [] as PbSeasonalParticle[]),
    pb
      .collection("seasonal_characters")
      .getFullList<PbSeasonalCharacter>({
        sort: "sort_order,key",
      })
      .catch(() => [] as PbSeasonalCharacter[]),
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
  const tours = toursRaw.filter(isGuestCatalogTour);
  const seasonalHighlights = seasonalHighlightsRaw.filter(
    (h) => h.is_active !== false
  );
  const seasonTiers = seasonTiersRaw.filter((t) => t.is_active !== false);
  const seasonalParticles = seasonalParticlesRaw.filter(
    (p) => p.is_active !== false
  );
  const seasonalCharacters = seasonalCharactersRaw.filter(
    (c) => c.is_active !== false
  );
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

  // Sync ambient FX date windows for TimingSelector / DurationEditor
  setSeasonalParticleRules(seasonalParticles);
  setSeasonalCharacterRules(seasonalCharacters);

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
    seasonalParticles,
    seasonalCharacters,
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
  const [toursRaw, eap] = await Promise.all([
    pb
      .collection("tours")
      .getFullList<PbTour>({ sort: "title", expand: "city_id" })
      .catch(() => [] as PbTour[]),
    fetchExperiencesAndPlaces(),
  ]);
  const tours = toursRaw.filter(isGuestCatalogTour);
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
        "(pricing_tier = 'free' || pricing_tier = 'low_cost' || is_self_guided = true) && is_bonus != true",
      sort: "base_price_eur,price_1_pax,title",
      expand: "city_id",
    });
    const rest = await pb.collection("tours").getFullList<PbTour>({
      filter:
        "(pricing_tier != 'free' && pricing_tier != 'low_cost' && is_self_guided != true) && is_bonus != true",
      sort: "price_1_pax,title",
      expand: "city_id",
    });
    const seen = new Set(curated.map((t) => t.id));
    return [...curated, ...rest.filter((t) => !seen.has(t.id))].filter(
      isGuestCatalogTour
    );
  } catch {
    const all = await pb.collection("tours").getFullList<PbTour>({
      sort: "price_1_pax,title",
      expand: "city_id",
    });
    return all.filter(isGuestCatalogTour);
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
  const tours = toursRaw.filter(isGuestCatalogTour);
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
