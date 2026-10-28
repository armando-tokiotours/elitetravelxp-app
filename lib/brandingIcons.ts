/**
 * ICONS management (Site Branding → ICONS).
 *
 * Storage choice: the existing generic key→item map, PocketBase
 * `branding_ui_items`. Each def below points at a real branding row
 * (`pre_elite_*` rows already used by Pre-Builder, `pace_*` rows by
 * Travel Pace) and only adds one generic file field on that collection,
 * `icon` (migrations 1791240000 + 1791250000: JPG/WebP card-background
 * photo, 800×400px 2:1, ≤300KB) — no per-key PB fields, no new JSON
 * blob on `site_branding`. Uploads go through the same authenticated
 * PocketBase client every other Site Branding tab uses (not
 * /api/upload, which needs a staff-credential token the Team Access
 * PB client does not carry). The public store
 * (`useSiteBrandingStore.fetchBrandingUiItems`) already loads these
 * rows guest-side, so `getBrandingIconUrl(key)` can resolve uploaded
 * icons anywhere that store is loaded.
 */
import { INTERESTS, MOTIVATIONS, PAIN_POINTS, TRAVEL_STYLES } from "@/lib/preEliteBuilder";
import { TRAVEL_PACES } from "@/lib/travelPace";
import { paceBrandingKey } from "@/lib/brandingUi";
import { preEliteBrandingKey } from "@/lib/preEliteBranding";

/** Card-background spec: JPG/WebP photo, 800×400px (2:1 landscape), ≤300KB. */
export const BRANDING_ICON_MAX_BYTES = 300 * 1024;
export const BRANDING_ICON_ACCEPT = ".jpg,.jpeg,.webp,image/jpeg,image/webp";

export interface BrandingIconDef {
  /** Canonical icon key passed to `getBrandingIconUrl(key)`. */
  key: string;
  /** `branding_ui_items.key` row that carries the `icon` file. */
  brandingKey: string;
  group: string;
  /** System label, e.g. "VIP Bespoke". */
  label: string;
  /** Usage context, e.g. "Travel Style: VIP Bespoke". */
  context: string;
  /** Emoji currently shown by the Travel Brief widget (fallback). */
  emoji: string;
}

function defsFor(
  group: string,
  contextPrefix: string,
  options: readonly { id: string; title?: string; label?: string }[],
  brandingKeyFor: (id: string) => string,
  emojiFor: (id: string) => string
): BrandingIconDef[] {
  return options.map((o) => {
    const label = o.title || o.label || o.id;
    return {
      key: brandingKeyFor(o.id),
      brandingKey: brandingKeyFor(o.id),
      group,
      label,
      context: `${contextPrefix}: ${label}`,
      emoji: emojiFor(o.id),
    };
  });
}

const STYLE_EMOJI: Record<string, string> = {
  classic_explorer: "🗺️",
  premium_comfort: "🛎️",
  vip_bespoke: "💎",
};
const BRIEF_EMOJI: Record<string, string> = {
  family: "👨‍👩‍👧‍👦",
  romantic: "💑",
  solo: "🚶",
  first_time: "📸",
  culture_heritage: "🏯",
  food_culinary: "🍣",
  modern_pop: "👾",
  nature_day_trips: "🌲",
};
const PAIN_EMOJI: Record<string, string> = {
  language_transit: "🗣️🚇",
  tourist_traps: "🚫",
  authentic_dining: "🍜",
  packed_itinerary: "⏳",
};
const PACE_EMOJI: Record<string, string> = {
  fast: "⚡",
  moderate: "🧭",
  relaxed: "🌿",
};

export const BRANDING_ICON_DEFS: BrandingIconDef[] = [
  ...defsFor("Travel Style", "Travel Style", TRAVEL_STYLES, preEliteBrandingKey, (id) => STYLE_EMOJI[id] || "✈️"),
  ...defsFor("Motivation", "Motivation", MOTIVATIONS, preEliteBrandingKey, (id) => BRIEF_EMOJI[id] || "✈️"),
  ...defsFor("Interests", "Interests", INTERESTS, preEliteBrandingKey, (id) => BRIEF_EMOJI[id] || "✈️"),
  ...defsFor("Avoid / Pain Points", "Avoid", PAIN_POINTS, preEliteBrandingKey, (id) => PAIN_EMOJI[id] || "⚠️"),
  ...defsFor("Pace", "Travel Pace", TRAVEL_PACES, paceBrandingKey, (id) => PACE_EMOJI[id] || "✈️"),
];

export const BRANDING_ICON_GROUPS = [...new Set(BRANDING_ICON_DEFS.map((d) => d.group))];

/** Max split-background cells shown on a Travel Brief snapshot tile. */
export const BRIEF_TILE_MAX_SPLITS = 4;

export interface BriefTileImage {
  key: string;
  /** Uploaded PB `branding_ui_items.icon` URL, or "" (emoji fallback). */
  imageUrl: string;
}

/**
 * Resolve Travel Brief tile background images for `keys`.
 *
 * Image source — no duplicate/hardcoded `/assets/brief/*.jpg` map and no
 * per-render DB/network fetch: callers pass the global, cached
 * `useSiteBrandingStore` resolver (`getBrandingIconUrl`), which reads the
 * already-loaded `itemsByKey` map (rows from PocketBase
 * `branding_ui_items`, `icon` file field, managed in Site Branding →
 * ICONS). `store.ensureLoaded()` already dedupes the single load, so
 * this pure selector is safe to memoize on `itemsByKey` + selected keys.
 */
export function resolveBriefTileImages(
  keys: readonly string[],
  getIconUrl: (key: string) => string
): BriefTileImage[] {
  return keys.slice(0, BRIEF_TILE_MAX_SPLITS).map((key) => ({
    key,
    imageUrl: getIconUrl(key),
  }));
}

export function travelStyleIconKey(id: string): string {
  return preEliteBrandingKey(id);
}
export function preEliteIconKey(id: string): string {
  return preEliteBrandingKey(id);
}
export function paceIconKey(id: string): string {
  return paceBrandingKey(id);
}

/** Returns an error message, or null when the file is a valid card background. */
export function validateBrandingIconFile(file: File): string | null {
  if (file.size === 0) return "That file is empty.";
  const name = file.name.toLowerCase();
  const okType =
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp");
  if (!okType)
    return "Card background must be JPG or WebP (800×400px, 2:1 landscape) — SVG/PNG are no longer accepted for these photo backgrounds.";
  if (file.size > BRANDING_ICON_MAX_BYTES) {
    return `Background is ${(file.size / 1024).toFixed(1)}KB — max 300KB. Please compress it (800×400px JPG/WebP recommended).`;
  }
  return null;
}
