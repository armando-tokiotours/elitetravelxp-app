/**
 * Canonical Tokiotours builder URLs (aliases keep legacy paths working via redirects).
 */
export const BUILDER_ROUTES = {
  /** Multi-day Grand Japan Journey */
  japanJourney: "/builder/japan-journey",
  japanJourneyItinerary: "/builder/japan-journey/itinerary",
  /** Single-day 1-Day Express Pass */
  dayPass: "/builder/day-pass",
  dayPassItinerary: "/builder/day-pass/itinerary",
  /** VIP Tickets & Local Access */
  vipAccess: "/builder/vip-access",
  vipAccessDossier: "/builder/vip-access/dossier",
  /** Guest dossier pass by PNR */
  dossier: (pnr: string) => `/dossier/${encodeURIComponent(pnr)}`,
} as const;

/** Legacy paths still linked from older clients / bookmarks. */
export const LEGACY_BUILDER_ROUTES = {
  single: "/builder-single",
  singleItinerary: "/builder-single/itinerary",
  multi: "/builder",
  multiItinerary: "/builder/itinerary",
  vip: "/builder-e",
  vipDossier: "/builder-e/dossier",
} as const;
