/**
 * Canonical TokioTours booking reference (PNR).
 * Format: JPN- + 6 chars from alphabet excluding 0/O/1/I.
 * Never mint TMP- or TK- for new bookings.
 */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePNR(): string {
  let pnr = "JPN-";
  for (let i = 0; i < 6; i++) {
    pnr += PNR_CHARS.charAt(Math.floor(Math.random() * PNR_CHARS.length));
  }
  return pnr;
}

/** Canonical official JPN-XXXXXX. */
export const JPN_PNR_RE = /^JPN-[A-Z2-9]{6}$/;

/** @deprecated Alias — same as JPN_PNR_RE. */
export const LEGACY_JPN_PNR_RE = JPN_PNR_RE;

/** Legacy short TK-XXXX (read-only; do not mint). */
export const TK_PNR_RE = /^TK-[A-Z2-9]{4}$/;

/** Legacy draft TMP-XXXXXX (read-only; promote to JPN- on normalize). */
export const LEGACY_TMP_PNR_RE = /^TMP-[A-Z2-9]{6}$/;
