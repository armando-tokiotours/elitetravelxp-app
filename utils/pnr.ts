/** Airline-style booking PNR helpers (TMP- draft vs JPN- official). */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

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

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += PNR_CHARS.charAt(Math.floor(Math.random() * PNR_CHARS.length));
  }
  return code;
}

/** Draft session reference: TMP- + 6 chars. */
export function generateTempPNR(): string {
  return `TMP-${randomCode(6)}`;
}

/** Official locked reference: JPN- + 6 chars. */
export function generateConfirmedPNR(): string {
  return `JPN-${randomCode(6)}`;
}

/** @deprecated Use generateTempPNR */
export const generateTempBookingRef = generateTempPNR;

/** @deprecated Use generateConfirmedPNR */
export const generateBookingPNR = generateConfirmedPNR;

/** Promote TMP-XXXXXX → JPN-XXXXXX (same body). */
export function promoteTempToOfficial(ref: string): string {
  const cleaned = String(ref || "")
    .trim()
    .toUpperCase();
  if (/^TMP-[A-Z2-9]{6}$/.test(cleaned)) {
    return `JPN-${cleaned.slice(4)}`;
  }
  if (isValidBookingPNR(cleaned)) return normalizeBookingPNR(cleaned);
  return generateConfirmedPNR();
}

/** Resolve draft input to an official JPN- code (promote TMP or pass-through JPN). */
export function resolveOfficialPNR(preferred?: string): string {
  const cleaned = String(preferred || "")
    .trim()
    .toUpperCase();
  if (/^TMP-[A-Z2-9]{6}$/.test(cleaned)) {
    return promoteTempToOfficial(cleaned);
  }
  if (isValidBookingPNR(cleaned)) return cleaned;
  return generateConfirmedPNR();
}

export function normalizeBookingPNR(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (/^JPN-[A-Z2-9]{6}$/.test(cleaned)) return cleaned;
  if (/^TMP-[A-Z2-9]{6}$/.test(cleaned)) return cleaned;
  if (/^[A-Z2-9]{6}$/.test(cleaned)) return `JPN-${cleaned}`;
  return cleaned;
}

export function isValidBookingPNR(raw: string): boolean {
  return /^JPN-[A-Z2-9]{6}$/.test(normalizeBookingPNR(raw));
}

export function isTempBookingRef(raw: string): boolean {
  return /^TMP-[A-Z2-9]{6}$/.test(normalizeBookingPNR(raw));
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
    return opts.tempBookingRef || "";
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
