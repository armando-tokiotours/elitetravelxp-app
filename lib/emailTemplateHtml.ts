/**
 * TOKIOTOURS proposal email HTML — solid dark ambient (no white client chrome).
 * Delegates to the three-tier bookingPassEmail layout.
 */

import { generateBookingEmailHtml } from "@/lib/emailTemplates/bookingPassEmail";

export type ProposalTripMeta = {
  tourType?: "single_day" | "multi_day" | null;
  /** ISO date YYYY-MM-DD or already display-formatted */
  tourDate?: string | null;
  adults?: number;
  children?: number;
  customerEmail?: string | null;
};

export type ProposalEmailParams = {
  fullName: string;
  bookingRef: string;
  headerTitle?: string;
  welcomeBody?: string;
  ctaButtonText?: string;
  ctaUrl?: string;
  /** Base site URL; manage / dossier links built from bookingRef + email */
  siteOrigin?: string;
  travelStyle?: string | null;
  experienceTier?: string | null;
  endDate?: string | null;
  /** Include deposit / how-booking-works disclosure (Send / Print). */
  includeBookingDisclosure?: boolean;
} & ProposalTripMeta;

/** Format ISO YYYY-MM-DD → `24 Sep 2026`. */
export function formatEmailDisplayDate(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  if (/[A-Za-z]{3}/.test(iso) && !/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    return iso;
  }
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * Full HTML email body for itinerary proposals.
 */
export function renderProposalEmailHtml(params: ProposalEmailParams): string {
  const fullName = params.fullName || "Valued Guest";
  const bookingRef = params.bookingRef || "TMP-BOOKING";
  const emailRaw = String(params.customerEmail || "").trim().toLowerCase();
  const origin = params.siteOrigin || "https://tokiotours-app.com";

  const isSingle = params.tourType === "single_day";
  const dateLabel = formatEmailDisplayDate(params.tourDate);
  const endDateLabel = formatEmailDisplayDate(params.endDate);
  const adults = Math.max(0, Number(params.adults) || 0);
  const kids = Math.max(0, Number(params.children) || 0);
  const guestsLabel = `${adults} Adult${adults === 1 ? "" : "s"}, ${kids} Child${kids === 1 ? "" : "ren"}`;
  const styleLabel = params.travelStyle || "Premium Comfort";
  const experienceLabel =
    params.experienceTier ||
    (isSingle ? "Day Tour" : "Premium Concierge");

  return generateBookingEmailHtml({
    pnrCode: bookingRef,
    guestName: fullName,
    guestEmail: emailRaw,
    partyText: guestsLabel,
    travelStyle: `${styleLabel} · ${experienceLabel}`,
    startDateText: dateLabel,
    endDateText: endDateLabel !== "—" ? endDateLabel : null,
    siteOrigin: origin,
    welcomeBody: params.welcomeBody,
    ctaButtonText: params.ctaButtonText,
    ctaUrl: params.ctaUrl,
    includeWalletCta: true,
    includeBookingDisclosure: params.includeBookingDisclosure !== false,
  });
}
