import type {
  BookingPassProps,
  BookingPassStatus,
  RouteBreakdownItem,
} from "@/components/dossier/JapanBookingPass.types";
import type { BookingStatus } from "@/utils/pnr";
import { activeBookingRef } from "@/utils/pnr";
import { BRAND_DOMAIN } from "@/lib/brand";
import { formatDisplayDate } from "@/store/useBuilderStore";
import type { ExperienceService, LocationStop } from "@/store/useBuilderStore";
import { isTransitHubStop } from "@/lib/transitHubs";
import {
  isTransitServiceItem,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  isPrivateVehicleHaystack,
  matchesIcCardHaystack,
} from "@/lib/ticketNormalizer";
import {
  toPassStatusLabel,
  toUnifiedPbStatus,
} from "@/lib/bookingStatus";

export function mapBookingStatusToPass(
  status: BookingStatus | string,
  opts?: {
    depositPaidEur?: number | null;
    hasPaidFull?: boolean | null;
  }
): BookingPassStatus {
  if (opts) {
    return toUnifiedPbStatus(status, opts) as BookingPassStatus;
  }
  return toPassStatusLabel(status) as BookingPassStatus;
}

export function formatGuestCountText(adults: number, children: number): string {
  if (children > 0) {
    return `${adults} ADULT${adults === 1 ? "" : "S"}, ${children} CHILD${children === 1 ? "" : "REN"}`;
  }
  return `${adults} ADULT${adults === 1 ? "" : "S"}`;
}

/** Uppercase pass date line (e.g. "30 SEPT 2026"). */
export function formatPassDateLine(iso: string | null | undefined): string {
  const raw = formatDisplayDate(iso);
  if (!raw || raw === "—") return "";
  return raw.toUpperCase();
}

export function experienceTierLabel(
  experienceService: ExperienceService,
  isEliteConcierge: boolean
): string {
  if (experienceService === "concierge" || isEliteConcierge) {
    return "PREMIUM CONCIERGE";
  }
  if (experienceService === "tailored") {
    return "SELF-GUIDED HYBRID";
  }
  return "SELF-GUIDED HYBRID";
}

export type PassHighlightTitleInput =
  | string
  | {
      title?: string | null;
      /** Ticket / place / activity extras sit outside the guided-tour budget. */
      is_extra?: boolean | null;
      /** Catalog / cart kind fields — used to drop movement/transport rows. */
      category?: string | null;
      entry_type?: string | null;
      entryType?: string | null;
      access_type?: string | null;
      accessType?: string | null;
      kind?: string | null;
      catalogKind?: string | null;
    }
  | null
  | undefined;

/** Structured kind/category values that mean movement/transport, never a highlight. */
function fieldIndicatesTransport(raw: string | null | undefined): boolean {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return false;
  // Exact catalog/cart kinds first (tour/activity/cluster/place stay allowed).
  if (
    v === "movement" ||
    v === "transport" ||
    v === "transit" ||
    v === "transfer" ||
    v === "transport_product" ||
    v === "transport_products"
  ) {
    return true;
  }
  // Compound labels e.g. "Transport", "Airport transfer", "public_transit".
  return /(movement|transport|transit|transfer|chauffeur|subway)/.test(v);
}

const TRANSIT_TITLE_PATTERNS: RegExp[] = [
  /\bsubway\b/,
  /\bsuica\b/,
  /\bpasmo\b/,
  /\bicoca\b/,
  /\bic[\s-]?cards?\b/,
  /\bjr\s*pass\b/,
  /\bjapan\s+rail(?:way)?\s+pass\b/,
  /\brail\s*pass\b/,
  /\bmetro\s*pass\b/,
  /\bsubway\s*pass\b/,
  /\btransit\s*pass\b/,
  /\btransport(?:ation)?\s*pass\b/,
  /\btransit\b/,
  /\btransport(?:ation)?\b/,
  /\bmovement\b/,
  /\btransfers?\b/,
  /\bchauffeur\b/,
  /\bvehicles?\b/,
  /\bprivate\s+(?:car|driver|vehicle|van|chauffeur)\b/,
  /\bshinkansen\s+(?:ticket|pass)\b/,
];

/**
 * True when a would-be highlight is actually transport / movement / transit.
 *
 * Order matters: structured kind/category/entry/access fields win, then the
 * existing cart classifiers (`isTransitServiceItem` — private car/transfer,
 * IC-card haystack — Suica/PASMO/IC), then a title-only keyword check as a
 * last resort for rows that arrive as bare strings (invoice transit lines
 * seeded into the agent cart, e.g. "Subway / IC — guest has own card
 * (no Suica fee)"). Title-only, never description, so a real tour whose
 * description mentions a transfer is not dropped; attraction tickets
 * (TeamLab, museums…) are not transit and stay.
 */
export function isPassHighlightTransportItem(
  item: PassHighlightTitleInput
): boolean {
  if (!item) return false;
  const title = typeof item === "string" ? item : item.title;
  const fields =
    typeof item === "string"
      ? []
      : [
          item.category,
          item.entry_type,
          item.entryType,
          item.access_type,
          item.accessType,
          item.kind,
          item.catalogKind,
        ];
  if (fields.some(fieldIndicatesTransport)) return true;

  const v = String(title || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!v) return false;
  if (matchesIcCardHaystack(v) || isPrivateVehicleHaystack(v)) return true;
  if (TRANSIT_TITLE_PATTERNS.some((re) => re.test(v))) return true;

  // Existing agent-cart classifier (private vehicle / TRANSPORT category).
  // Suica-type lines return false here because tickets win in that
  // classifier — the IC/title checks above are what catch those.
  const category =
    (typeof item !== "string" && fields.find((f) => String(f || "").trim())) ||
    undefined;
  return isTransitServiceItem({
    title: String(title || ""),
    category,
  } as ServiceLineItem);
}

/**
 * Single-day HIGHLIGHTS & AREA line — booked tour / activity titles,
 * e.g. "2 Faces of Tokyo · TeamLab Planets".
 *
 * Guided tours first, then experiences/activities/extras, de-duplicated.
 * Movement / transport (walking, luxury vehicle, guide preference…) never
 * belongs here — it has its own badges elsewhere on the dossier.
 *
 * Fallback when nothing is selected yet: the area/city only (e.g. "TOKYO"),
 * or "TO BE CURATED" when no area is known either.
 */
export function buildSingleDayHighlights(opts: {
  cityFocus?: string | null;
  experiences?: ReadonlyArray<PassHighlightTitleInput>;
  /** Extra titles (e.g. Ops agent-cart TOUR/TICKET lines) used only when not already listed. */
  fallbackTitles?: ReadonlyArray<PassHighlightTitleInput>;
}): string {
  const guided: string[] = [];
  const extras: string[] = [];
  const seen = new Set<string>();
  const push = (bucket: string[], raw: string | null | undefined) => {
    const title = String(raw || "").replace(/\s+/g, " ").trim();
    if (!title) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push(title);
  };
  for (const item of opts.experiences || []) {
    if (isPassHighlightTransportItem(item)) continue;
    if (typeof item === "string") {
      push(guided, item);
    } else if (item) {
      push(item.is_extra ? extras : guided, item.title);
    }
  }
  const titles = [...guided, ...extras];
  for (const item of opts.fallbackTitles || []) {
    if (isPassHighlightTransportItem(item)) continue;
    push(titles, typeof item === "string" ? item : item?.title);
  }
  if (titles.length > 0) return titles.join(" · ");
  const area = String(opts.cityFocus || "").replace(/\s+/g, " ").trim();
  if (area && !/city tbd/i.test(area)) return area.toUpperCase();
  return "TO BE CURATED";
}

export function buildRouteBreakdown(
  locations: LocationStop[],
  cityName: (cityId: string) => string
): RouteBreakdownItem[] {
  return locations
    .filter(
      (l) => !isTransitHubStop(l) && (l.visitType === "stay" || !l.visitType)
    )
    .map((l) => ({
      city: (cityName(l.cityId) || l.cityId || "CITY").toUpperCase(),
      nights: Math.max(0, Math.round(Number(l.nights) || 0)),
    }))
    .filter((item) => item.nights > 0 || item.city);
}

/** Stable absolute dossier URL for QR / Wallet (SSR-safe, no window). */
export function buildDossierQrUrl(pnrCode: string, path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${BRAND_DOMAIN}`
  ).replace(/\/$/, "");
  return `${base}${path}?ref=${encodeURIComponent(pnrCode)}&view=dossier`;
}

export function resolvePnr(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
}): string {
  return (
    activeBookingRef(opts) ||
    opts.confirmedBookingRef ||
    opts.tempBookingRef ||
    "······"
  );
}

export type { BookingPassProps, RouteBreakdownItem };
