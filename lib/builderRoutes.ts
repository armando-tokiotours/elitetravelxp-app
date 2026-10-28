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

/**
 * Booking product discriminator used across the repo:
 * `bookings_and_leads.type` ∈ multi_day | single_day | experience_only
 * (mirrored in builder stores as `tripMode` ∈ multi_day | single_day).
 * OpsHubRow has no type field — Ops surfaces resolve it from the BAL row
 * (see `opsProductLabelFromLead` in lib/opsGuestRequirements.ts).
 */
export type JourneyBookingKind =
  | "single_day"
  | "multi_day"
  | "experience_only";

export interface JourneyRouteSignals {
  /** BAL `type`, pre-elite `tripType`, or builder `tripMode` value. */
  type?: string | null;
  tripMode?: string | null;
  /** True when a single-day (Builder S) selections/state blob is present. */
  hasSingleDay?: boolean | null;
  /** Brand product label, e.g. "1-Day Express Pass" (Ops header). */
  productLabel?: string | null;
}

function normKindToken(v?: string | null): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

/** True for every single-day token used in the repo. */
export function isSingleDayBookingType(v?: string | null): boolean {
  const t = normKindToken(v);
  return t === "single_day" || t === "single" || t === "day_pass";
}

export function isExperienceOnlyBookingType(v?: string | null): boolean {
  const t = normKindToken(v);
  return (
    t === "experience_only" ||
    t === "experience" ||
    t === "builder_e" ||
    t === "vip" ||
    t === "vip_tickets"
  );
}

/** Resolve which builder a booking belongs to from any known signal. */
export function resolveJourneyBookingKind(
  signals: JourneyRouteSignals = {}
): JourneyBookingKind {
  const label = String(signals.productLabel || "").toLowerCase();
  if (label.includes("1-day") || label.includes("1 day")) return "single_day";
  if (label.includes("vip tickets")) return "experience_only";
  if (label.includes("grand japan")) return "multi_day";
  if (signals.hasSingleDay) return "single_day";
  for (const v of [signals.type, signals.tripMode]) {
    if (isSingleDayBookingType(v)) return "single_day";
    if (isExperienceOnlyBookingType(v)) return "experience_only";
  }
  return "multi_day";
}

export function isSingleDayJourney(
  signals: JourneyRouteSignals = {}
): boolean {
  return resolveJourneyBookingKind(signals) === "single_day";
}

function withRefAndView(
  base: string,
  ref?: string | null,
  view?: string | null
): string {
  const q = new URLSearchParams();
  const cleanRef = String(ref || "").trim();
  if (cleanRef) q.set("ref", cleanRef);
  if (view) q.set("view", view);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Canonical Journey itinerary (guest dossier) URL for a booking.
 * Single-day / 1-Day Express Pass → Single-Day Builder dossier
 * (`/builder/day-pass/itinerary`, legacy `/builder-single/itinerary`);
 * multi-day → Grand Japan Journey dossier
 * (`/builder/japan-journey/itinerary`, legacy `/builder/itinerary`).
 * The itinerary pages read the PNR from `?ref=` (+ `?view=dossier`).
 */
export function journeyItineraryHref(
  ref?: string | null,
  signals: JourneyRouteSignals & { view?: string | null } = {}
): string {
  const kind = resolveJourneyBookingKind(signals);
  const base =
    kind === "single_day"
      ? BUILDER_ROUTES.dayPassItinerary
      : kind === "experience_only"
        ? BUILDER_ROUTES.vipAccessDossier
        : BUILDER_ROUTES.japanJourneyItinerary;
  const view =
    signals.view === null
      ? null
      : signals.view || (kind === "experience_only" ? null : "dossier");
  return withRefAndView(base, ref, view);
}

/** Canonical Journey builder (edit) URL for a booking. */
export function journeyBuilderHref(
  ref?: string | null,
  signals: JourneyRouteSignals = {}
): string {
  const kind = resolveJourneyBookingKind(signals);
  const base =
    kind === "single_day"
      ? BUILDER_ROUTES.dayPass
      : kind === "experience_only"
        ? BUILDER_ROUTES.vipAccess
        : BUILDER_ROUTES.japanJourney;
  return withRefAndView(base, ref, null);
}

/** Legacy paths still linked from older clients / bookmarks. */
export const LEGACY_BUILDER_ROUTES = {
  single: "/builder-single",
  singleItinerary: "/builder-single/itinerary",
  multi: "/builder",
  multiItinerary: "/builder/itinerary",
  vip: "/builder-e",
  vipDossier: "/builder-e/dossier",
} as const;
