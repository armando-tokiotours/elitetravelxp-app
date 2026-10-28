/**
 * Stable branding image slots — the single source of truth for image IDs.
 *
 * Every branding/quiz image lives OUTSIDE PocketBase under
 * `public/uploads/branding/` with ONE fixed ID per image:
 *
 *   /uploads/branding/{slot}.webp          web master (≤1600w, WebP q80)
 *   /uploads/branding/{slot}--mobile.webp  mobile proxy (≤768w, WebP q75)
 *
 * Replacing an image in Site Branding overwrites the same two files —
 * the ID/URL never changes, so code never renames anything and no
 * orphan files accumulate. PocketBase only stores these URL strings
 * (in JSON/text), never image binaries for these slots.
 *
 * Slot naming:
 *   preelite-{optionId}-card          Pre-Builder selected-card photo
 *   preelite-{optionId}-slide{1|2|3}  Pre-Builder story slides
 *   preelite-{optionId}-slide{n}-poster / -card-poster  video stills
 *   home-card-{single|experience|multiday}  homepage finale card photo
 *   hero-panel-p{n}                   homepage grid panels (hero-panels folder)
 */

export const BRANDING_UPLOADS_BASE = "/uploads/branding";

export function brandingSlotWebUrl(stableKey: string): string {
  return `${BRANDING_UPLOADS_BASE}/${stableKey}.webp`;
}

export function brandingSlotMobileUrl(stableKey: string): string {
  return `${BRANDING_UPLOADS_BASE}/${stableKey}--mobile.webp`;
}

export function brandingSlotSrcSet(stableKey: string): string {
  return `${brandingSlotMobileUrl(stableKey)} 768w, ${brandingSlotWebUrl(stableKey)} 1600w`;
}

/** Pre-Builder option selected-card photo slot (Step 1–4 options). */
export function preEliteCardSlot(optionId: string): string {
  return `preelite-${optionId}-card`;
}

/** Pre-Builder story slide slot (1-based). */
export function preEliteSlideSlot(optionId: string, slide: 1 | 2 | 3): string {
  return `preelite-${optionId}-slide${slide}`;
}

/** Pre-Builder video-still (poster) slot. */
export function preEliteSlidePosterSlot(
  optionId: string,
  slide: 1 | 2 | 3 | "card"
): string {
  return slide === "card"
    ? `preelite-${optionId}-card-poster`
    : `preelite-${optionId}-slide${slide}-poster`;
}

/** Homepage finale card photo slot. */
export function homeCardSlot(cardId: string): string {
  return `home-card-${cardId}`;
}

export type BuilderHeroKind = "multiday" | "single" | "activities";

/** The ONE hero slot per builder (M / S / E) — same ID in every editor. */
export function builderHeroSlot(kind: BuilderHeroKind): string {
  return kind === "multiday"
    ? "builder-multiday-hero"
    : kind === "single"
      ? "builder-single-hero"
      : "builder-activities-hero";
}

/** branding_ui_items key that version-stamps the Activities (Builder E) hero. */
export const BUILDER_ACTIVITIES_HERO_KEY = "builder_activities_hero";

/** Distinct pagoda asset (Pre-Elite story fallback still) — its own slot. */
export function heroJapanPagodaSlot(): string {
  return "hero-japan-pagoda";
}

/** ONE image space per branding_ui_items key (Transport / Pace / Explanations). */
export function brandingKeyImageSlot(key: string): string {
  return `branding-${key}`;
}

/** Append ?v= cache-buster when a version stamp exists. */
export function brandingSlotVersionedUrl(
  stableKey: string,
  version?: string | null
): string {
  const url = brandingSlotWebUrl(stableKey);
  const v = String(version || "").trim();
  return v ? `${url}?v=${encodeURIComponent(v)}` : url;
}
