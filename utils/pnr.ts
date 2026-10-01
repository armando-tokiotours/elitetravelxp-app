/**
 * Booking PNR helpers.
 * Canonical format: JPN-XXXXXX (see lib/generatePNR.ts).
 * Legacy TMP- / TK- still accepted when reading old rows — never minted.
 */

import {
  generatePNR,
  JPN_PNR_RE,
  LEGACY_JPN_PNR_RE,
  LEGACY_TMP_PNR_RE,
  TK_PNR_RE,
} from "@/lib/generatePNR";

export { generatePNR } from "@/lib/generatePNR";
export { JPN_PNR_RE, LEGACY_JPN_PNR_RE, LEGACY_TMP_PNR_RE, TK_PNR_RE };

/**
 * Lead / itinerary lifecycle:
 * draft → in_progress (guest actions) → confirmed (admin only).
 *
 * Legacy aliases `requested` / `deposit_paid` normalize to `in_progress`.
 */
export type BookingStatus = "draft" | "in_progress" | "confirmed";

/** @deprecated Legacy persisted values — use normalizeBookingStatus(). */
export type LegacyBookingStatus =
  | BookingStatus
  | "requested"
  | "deposit_paid"
  | "pre_qualification";

export function normalizeBookingStatus(raw: unknown): BookingStatus {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "confirmed" || s === "contacted") return "confirmed";
  if (
    s === "in_progress" ||
    s === "requested" ||
    s === "deposit_paid" ||
    s === "quoted" ||
    s === "pending_deposit" ||
    s === "paid"
  ) {
    return "in_progress";
  }
  return "draft";
}

/** New sessions mint JPN-XXXXXX immediately (no TMP- / TK-). */
export function generateTempPNR(): string {
  return generatePNR();
}

/** Same as generatePNR — one format for draft and confirmed. */
export function generateConfirmedPNR(): string {
  return generatePNR();
}

/** @deprecated Use generateTempPNR / generatePNR */
export const generateTempBookingRef = generateTempPNR;

/** @deprecated Use generateConfirmedPNR / generatePNR */
export const generateBookingPNR = generateConfirmedPNR;

/**
 * Promote legacy TMP- → JPN- (same body).
 * JPN- and legacy TK- pass through. Unknown → mint JPN-.
 */
export function promoteTempToOfficial(ref: string): string {
  const cleaned = String(ref || "")
    .trim()
    .toUpperCase();
  if (LEGACY_TMP_PNR_RE.test(cleaned)) {
    return `JPN-${cleaned.slice(4)}`;
  }
  if (isOfficialPNR(cleaned)) {
    return normalizeBookingPNR(cleaned);
  }
  return generatePNR();
}

/** Prefer existing valid ref; otherwise mint JPN-. */
export function resolveOfficialPNR(preferred?: string): string {
  const cleaned = String(preferred || "")
    .trim()
    .toUpperCase();
  if (LEGACY_TMP_PNR_RE.test(cleaned)) {
    return promoteTempToOfficial(cleaned);
  }
  if (isOfficialPNR(cleaned)) return cleaned;
  if (LEGACY_TMP_PNR_RE.test(normalizeBookingPNR(cleaned))) {
    return promoteTempToOfficial(cleaned);
  }
  return generatePNR();
}

export function normalizeBookingPNR(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  // Legacy TMP drafts → official JPN (same body)
  if (LEGACY_TMP_PNR_RE.test(cleaned)) {
    return `JPN-${cleaned.slice(4)}`;
  }
  if (JPN_PNR_RE.test(cleaned)) return cleaned;
  if (TK_PNR_RE.test(cleaned)) return cleaned; // legacy short refs only
  // Bare 6-char body → JPN-
  if (/^[A-Z2-9]{6}$/.test(cleaned)) return `JPN-${cleaned}`;
  // Bare 4-char body → legacy TK- (do not invent JPN from short body)
  if (/^[A-Z2-9]{4}$/.test(cleaned)) return `TK-${cleaned}`;
  return cleaned;
}

function isOfficialPNR(cleaned: string): boolean {
  return JPN_PNR_RE.test(cleaned) || TK_PNR_RE.test(cleaned);
}

/** Any usable booking ref for APIs (JPN-, legacy TK-, or pre-normalize TMP-). */
export function isAcceptableBookingPNR(raw: string): boolean {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (LEGACY_TMP_PNR_RE.test(cleaned)) return true;
  const n = normalizeBookingPNR(raw);
  return JPN_PNR_RE.test(n) || TK_PNR_RE.test(n);
}

/**
 * Canonical / locked official ref (JPN- preferred; legacy TK- still valid).
 * New drafts use JPN- from the start.
 */
export function isValidBookingPNR(raw: string): boolean {
  const n = normalizeBookingPNR(raw);
  return JPN_PNR_RE.test(n) || TK_PNR_RE.test(n);
}

/**
 * True only for raw TMP- strings before normalize.
 * After normalizeBookingPNR, TMP becomes JPN so this is for pre-check only.
 */
export function isTempBookingRef(raw: string): boolean {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return LEGACY_TMP_PNR_RE.test(cleaned);
}

/** UI badge label per spec. */
export function bookingRefBadgeLabel(status: BookingStatus): string {
  switch (normalizeBookingStatus(status)) {
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In Progress";
    default:
      return "Draft (Not Confirmed)";
  }
}

export function bookingStatusLabel(status: BookingStatus | string): string {
  switch (normalizeBookingStatus(status)) {
    case "in_progress":
      return "In Progress";
    case "confirmed":
      return "Confirmed";
    default:
      return "Draft";
  }
}

/** Map PocketBase booking_requests / bookings.status → store bookingStatus. */
export function bookingStatusFromPbRecord(
  pbStatus: string | undefined,
  payloadStatus: BookingStatus | string | undefined
): BookingStatus {
  if (payloadStatus && normalizeBookingStatus(payloadStatus) !== "draft") {
    return normalizeBookingStatus(payloadStatus);
  }
  return normalizeBookingStatus(pbStatus ?? payloadStatus ?? "draft");
}

export function activeBookingRef(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
}): string {
  if (normalizeBookingStatus(opts.bookingStatus) === "draft") {
    return opts.tempBookingRef || opts.confirmedBookingRef || "";
  }
  return opts.confirmedBookingRef || opts.tempBookingRef || "";
}

export function formatBookingRefLabel(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
}): string {
  const code = activeBookingRef(opts);
  return `${code} · ${bookingRefBadgeLabel(opts.bookingStatus)}`;
}
