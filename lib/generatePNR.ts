/**
 * Canonical TokioTours booking reference (PNR).
 * - Pre-contact drafts: DRAFT-XXXXXX (local canvas until guest email/name).
 * - Official: JPN-XXXXXX (same 6-char body after promote).
 * Never mint TMP- or TK- for new bookings.
 */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mintBody(): string {
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += PNR_CHARS.charAt(Math.floor(Math.random() * PNR_CHARS.length));
  }
  return body;
}

/** Official / locked booking ref. */
export function generatePNR(): string {
  return `JPN-${mintBody()}`;
}

/** Instant local draft ref before guest contact is known. */
export function generateDraftPNR(): string {
  return `DRAFT-${mintBody()}`;
}

/** Canonical official JPN-XXXXXX. */
export const JPN_PNR_RE = /^JPN-[A-Z2-9]{6}$/;

/** Pre-contact draft DRAFT-XXXXXX. */
export const DRAFT_PNR_RE = /^DRAFT-[A-Z2-9]{6}$/;

/** @deprecated Alias — same as JPN_PNR_RE. */
export const LEGACY_JPN_PNR_RE = JPN_PNR_RE;

/** Legacy short TK-XXXX (read-only; do not mint). */
export const TK_PNR_RE = /^TK-[A-Z2-9]{4}$/;

/** Legacy draft TMP-XXXXXX (read-only; promote to JPN- on normalize). */
export const LEGACY_TMP_PNR_RE = /^TMP-[A-Z2-9]{6}$/;
