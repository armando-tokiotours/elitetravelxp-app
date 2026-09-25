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

export function mapBookingStatusToPass(
  status: BookingStatus
): BookingPassStatus {
  if (status === "confirmed") return "CONFIRMED";
  if (status === "in_progress") return "IN_PROGRESS";
  return "DRAFT";
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

/** Single-day highlights line, e.g. "TOKYO (WALKING + LUXURY VEHICLE)". */
export function buildSingleDayHighlights(opts: {
  cityFocus: string;
  guidePreference?: "private_guide" | "local_host" | "self_paced" | string | null;
}): string {
  const area = (opts.cityFocus || "TOKYO").trim().toUpperCase() || "TOKYO";
  const mode =
    opts.guidePreference === "self_paced"
      ? "WALKING"
      : opts.guidePreference === "local_host"
        ? "LOCAL HOST + TRANSIT"
        : "WALKING + LUXURY VEHICLE";
  return `${area} (${mode})`;
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
