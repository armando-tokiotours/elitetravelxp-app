/** Airline-style booking PNR helpers (TMP- draft vs JPN- official). */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

export type BookingStatus =
  | "draft"
  | "requested"
  | "deposit_paid"
  | "confirmed";

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
  return status === "draft" ? "Draft (Not Confirmed)" : "Confirmed";
}

export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "deposit_paid":
      return "Deposit Paid";
    case "confirmed":
      return "Confirmed";
    default:
      return "Draft (Not Confirmed)";
  }
}

/** Map PocketBase booking_requests.status → store bookingStatus. */
export function bookingStatusFromPbRecord(
  pbStatus: string | undefined,
  payloadStatus: BookingStatus | undefined
): BookingStatus {
  if (
    payloadStatus &&
    payloadStatus !== "draft"
  ) {
    return payloadStatus;
  }
  switch (pbStatus) {
    case "quoted":
      return "requested";
    case "pending_deposit":
    case "paid":
      return "deposit_paid";
    case "contacted":
      return "confirmed";
    default:
      return payloadStatus ?? "confirmed";
  }
}

export function activeBookingRef(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
}): string {
  if (opts.bookingStatus === "draft") {
    return opts.tempBookingRef || generateTempPNR();
  }
  return opts.confirmedBookingRef || opts.tempBookingRef || generateTempPNR();
}

export function formatBookingRefLabel(opts: {
  tempBookingRef: string;
  confirmedBookingRef: string | null;
  bookingStatus: BookingStatus;
}): string {
  const code = activeBookingRef(opts);
  return `${code} · ${bookingRefBadgeLabel(opts.bookingStatus)}`;
}
