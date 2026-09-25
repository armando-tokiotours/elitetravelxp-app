import type {
  BookingPassProps,
  BookingPassStatus,
} from "@/components/dossier/JapanBookingPass.types";
import type { BookingStatus } from "@/utils/pnr";
import { activeBookingRef } from "@/utils/pnr";
import { BRAND_DOMAIN } from "@/lib/brand";

export function mapBookingStatusToPass(
  status: BookingStatus
): BookingPassStatus {
  if (status === "confirmed") return "CONFIRMED";
  if (status === "in_progress") return "IN_PROGRESS";
  return "DRAFT";
}

export function formatGuestCountText(adults: number, children: number): string {
  if (children > 0) {
    return `${adults} Adult${adults === 1 ? "" : "s"}, ${children} Child${children === 1 ? "" : "ren"}`;
  }
  return `${adults} Adult${adults === 1 ? "" : "s"}`;
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

export type { BookingPassProps };
