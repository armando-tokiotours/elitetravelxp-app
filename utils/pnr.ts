/**
 * Booking PNR helpers.
 * - Pre-contact: DRAFT-XXXXXX (instant local canvas)
 * - Official: JPN-XXXXXX (after guest contact / confirm)
 * Legacy TMP- / TK- still accepted when reading old rows — never minted.
 */

import {
  DRAFT_PNR_RE,
  generateDraftPNR,
  generatePNR,
  JPN_PNR_RE,
  LEGACY_JPN_PNR_RE,
  LEGACY_TMP_PNR_RE,
  TK_PNR_RE,
} from "@/lib/generatePNR";

export { generatePNR, generateDraftPNR } from "@/lib/generatePNR";
export {
  DRAFT_PNR_RE,
  JPN_PNR_RE,
  LEGACY_JPN_PNR_RE,
  LEGACY_TMP_PNR_RE,
  TK_PNR_RE,
};

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

/** Mint a new pre-contact draft (DRAFT-XXXXXX). */
export function generateTempPNR(): string {
  return generateDraftPNR();
}

/** Official JPN- mint (post-contact / confirmed). */
export function generateConfirmedPNR(): string {
  return generatePNR();
}

/** @deprecated Use generateTempPNR / generateDraftPNR */
export const generateTempBookingRef = generateTempPNR;

/** @deprecated Use generateConfirmedPNR / generatePNR */
export const generateBookingPNR = generateConfirmedPNR;

function cleanRef(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Promote DRAFT- / legacy TMP- → JPN- (same body).
 * JPN- and legacy TK- pass through. Unknown → mint JPN-.
 */
export function promoteTempToOfficial(ref: string): string {
  const cleaned = cleanRef(ref);
  if (DRAFT_PNR_RE.test(cleaned)) {
    return `JPN-${cleaned.slice(6)}`;
  }
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
  const cleaned = cleanRef(preferred || "");
  if (DRAFT_PNR_RE.test(cleaned) || LEGACY_TMP_PNR_RE.test(cleaned)) {
    return promoteTempToOfficial(cleaned);
  }
  if (isOfficialPNR(cleaned)) return cleaned;
  return generatePNR();
}

/**
 * Normalize casing / bare bodies.
 * DRAFT- is preserved (not auto-promoted) so the UI can show a draft ref
 * until guest contact triggers promoteTempToOfficial.
 * Legacy TMP- still promotes to JPN- for backwards compatibility.
 */
export function normalizeBookingPNR(raw: string): string {
  const cleaned = cleanRef(raw);
  if (DRAFT_PNR_RE.test(cleaned)) return cleaned;
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

/** Any usable booking ref for APIs (JPN-, DRAFT-, legacy TK-/TMP-). */
export function isAcceptableBookingPNR(raw: string): boolean {
  const cleaned = cleanRef(raw);
  if (DRAFT_PNR_RE.test(cleaned) || LEGACY_TMP_PNR_RE.test(cleaned)) return true;
  const n = normalizeBookingPNR(raw);
  return JPN_PNR_RE.test(n) || TK_PNR_RE.test(n);
}

/**
 * Canonical / locked official ref (JPN- preferred; legacy TK- still valid).
 */
export function isValidBookingPNR(raw: string): boolean {
  const n = normalizeBookingPNR(raw);
  return JPN_PNR_RE.test(n) || TK_PNR_RE.test(n);
}

/**
 * True for pre-contact draft strings (DRAFT- or legacy TMP-).
 */
export function isTempBookingRef(raw: string): boolean {
  const cleaned = cleanRef(raw);
  return DRAFT_PNR_RE.test(cleaned) || LEGACY_TMP_PNR_RE.test(cleaned);
}

/** Field label above the ref code on Express Pass / builder header. */
export function bookingRefFieldLabel(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
  /** Guest has entered email (and optionally name). */
  hasGuestContact?: boolean;
}): string {
  const code = activeBookingRef(opts);
  if (isTempBookingRef(code)) return "Draft Booking Ref";
  if (
    opts.hasGuestContact === false &&
    normalizeBookingStatus(opts.bookingStatus) === "draft"
  ) {
    return "Draft Booking Ref";
  }
  if (
    opts.hasGuestContact !== true &&
    normalizeBookingStatus(opts.bookingStatus) === "draft" &&
    !opts.confirmedBookingRef
  ) {
    return "Draft Booking Ref";
  }
  return "Booking Ref";
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
