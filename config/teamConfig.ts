/**
 * Central copy for Builder S hero + step timeline.
 * Override via PocketBase `branding_ui_items` key `single_day_builder_hero`:
 *   title → scriptAccent · cta_primary → mainTitlePrefix · subtitle → tagline
 */

export const BUILDER_S_HERO_CONFIG = {
  /** Beauty-script accent overlaid on the scenic hero (mirrors Builder M “Japan!”) */
  scriptAccent: "Japan!",
  /** Hanson lines under the script */
  heroLine1: "DAY",
  heroLine2: "TOUR",
  mainTitlePrefix: "YOUR DAY IN",
  defaultCity: "TOKYO",
  /** Used when no city is selected; `{city}` is replaced when a city is set */
  tagline:
    "Curated 1-day immersive discovery across Japan's finest districts.",
  taglineWithCity:
    "Discover {city} in 1 Day — Curated Experiences & Private Transit.",
  bookingStatusLabel: "IN PROGRESS",
  steps: [
    {
      id: "duration",
      label: "Trip Duration",
      href: "#section-duration",
      number: 1,
      sectionId: "section-duration",
    },
    {
      id: "city",
      label: "City Focus",
      href: "#section-city-focus",
      number: 2,
      sectionId: "section-city-focus",
    },
    {
      id: "experiences",
      label: "Experiences & Places",
      href: "#section-experiences",
      number: 3,
      sectionId: "section-experiences",
    },
    {
      id: "transit",
      label: "Transit & Transfers",
      href: "#section-transit",
      number: 4,
      sectionId: "section-transit",
    },
  ],
} as const;

export type BuilderSStep = (typeof BUILDER_S_HERO_CONFIG.steps)[number];

export function builderSDisplayCity(cityFocus: string | null | undefined): string {
  const raw = (cityFocus || "").trim();
  return (raw || BUILDER_S_HERO_CONFIG.defaultCity).toUpperCase();
}

export function builderSTagline(
  cityFocus: string | null | undefined,
  /** Admin-configured tagline from `single_day_builder_hero.subtitle` */
  adminTagline?: string | null
): string {
  const hasCity = Boolean((cityFocus || "").trim());
  const city = builderSDisplayCity(cityFocus);
  if (hasCity) {
    return BUILDER_S_HERO_CONFIG.taglineWithCity.replace(/\{city\}/gi, city);
  }
  const custom = (adminTagline || "").trim();
  return custom || BUILDER_S_HERO_CONFIG.tagline;
}

/** Resolve Builder S hero copy from a branding_ui_items row (or store item). */
export function resolveBuilderSHeroCopy(item?: {
  title?: string | null;
  subtitle?: string | null;
  ctaPrimary?: string | null;
} | null) {
  return {
    scriptAccent:
      (item?.title || "").trim() || BUILDER_S_HERO_CONFIG.scriptAccent,
    mainTitlePrefix:
      (item?.ctaPrimary || "").trim() || BUILDER_S_HERO_CONFIG.mainTitlePrefix,
    tagline: (item?.subtitle || "").trim() || BUILDER_S_HERO_CONFIG.tagline,
  };
}
