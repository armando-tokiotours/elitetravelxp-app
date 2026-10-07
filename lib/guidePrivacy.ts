/**
 * Guest-facing guide / driver / concierge contact privacy.
 *
 * Unlock rule: booking is confirmed (confirmed | in_ops | done) AND fully paid.
 * Before unlock: first name + photo only; full name / email / phone stay hidden.
 *
 * Prefer staff_profiles.first_name when set. Do not rely on splitting a combined
 * display string for multi-part surnames (e.g. "Juan Carlos De La Cruz").
 */

import { toCanonicalStatus } from "@/lib/bookingStatus";
import {
  paymentBadgeForAmount,
  roundEur,
} from "@/lib/balanceSettlement";
import {
  deriveTourPaymentStatus,
  isTourFullyPaid,
} from "@/lib/tourPaymentStatus";
import { combineStaffDisplayName } from "@/lib/staffProfiles";

export const GUIDE_CONTACT_UNLOCK_MSG =
  "Full contact details unlock on final confirmation.";

export type GuidePrivacyInput = {
  status?: string | null;
  payment_confirmed?: boolean | null;
  tour_payment_status?: string | null;
  total_paid_eur?: number | null;
  estimated_total_eur?: number | null;
  deposit_amount?: number | null;
  concierge_fee_amount?: number | null;
  concierge_fee_paid?: boolean | null;
};

/** Canonical “booking confirmed” tier (not draft / incoming / quoted). */
export function isBookingConfirmedForPrivacy(
  status?: string | null
): boolean {
  const c = toCanonicalStatus(status);
  return c === "confirmed" || c === "in_ops" || c === "done";
}

/** Fully paid via tour_payment_status, payment_confirmed, or amount vs package. */
export function isFullyPaidForPrivacy(input: GuidePrivacyInput): boolean {
  if (isTourFullyPaid(input)) return true;

  const packageTotal = roundEur(Number(input.estimated_total_eur) || 0);
  const paid = roundEur(Number(input.total_paid_eur) || 0);
  if (packageTotal > 0 && paid > 0) {
    if (paymentBadgeForAmount(paid, packageTotal).fullyPaid) return true;
  }

  const derived = deriveTourPaymentStatus(input);
  return derived === "FULLY_PAID";
}

/** True only when guest may see full name + email + phone/WhatsApp. */
export function guideContactsUnlocked(input: GuidePrivacyInput): boolean {
  return (
    isBookingConfirmedForPrivacy(input.status) && isFullyPaidForPrivacy(input)
  );
}

/**
 * Legacy fallback: first whitespace-separated token.
 * Prefer staff_profiles.first_name via maskStaffContact({ firstName }) instead.
 */
export function firstNameOnly(fullName?: string | null): string {
  const raw = String(fullName || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0] || "";
}

export type MaskedStaffContact = {
  /** Guest-visible name (first name when locked, full when unlocked). */
  displayName: string | null;
  fullName: string | null;
  firstName: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  whatsappDigits: string | null;
  contactsUnlocked: boolean;
  unlockMessage: string | null;
};

/**
 * Mask staff contact for guest UI.
 * Photo always allowed when present; email/phone only when unlocked.
 * When firstName is provided (from staff_profiles.first_name), use it for the
 * locked display — do not token-split the combined full name.
 */
export function maskStaffContact(opts: {
  fullName?: string | null;
  /** Preferred: staff_profiles.first_name */
  firstName?: string | null;
  /** Preferred: staff_profiles.last_name (used to build full when unlocked) */
  lastName?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  contactsUnlocked: boolean;
}): MaskedStaffContact {
  const firstField = String(opts.firstName || "").trim();
  const lastField = String(opts.lastName || "").trim();
  const fromParts = combineStaffDisplayName(firstField, lastField);
  const full =
    fromParts || String(opts.fullName || "").trim() || null;
  // DB first_name wins; token-split only when first_name never set (legacy rows).
  const first = firstField || firstNameOnly(full) || null;
  const photoUrl = String(opts.photoUrl || "").trim() || null;
  const emailRaw = String(opts.email || "").trim() || null;
  const phoneRaw = String(opts.phone || "").trim() || null;
  const digits = phoneRaw ? phoneRaw.replace(/\D/g, "") : "";
  const whatsappDigits = digits.length >= 8 ? digits : null;

  if (!opts.contactsUnlocked) {
    return {
      displayName: first,
      fullName: full,
      firstName: first,
      photoUrl,
      email: null,
      phone: null,
      whatsappDigits: null,
      contactsUnlocked: false,
      unlockMessage: full || photoUrl ? GUIDE_CONTACT_UNLOCK_MSG : null,
    };
  }

  return {
    displayName: full || first,
    fullName: full,
    firstName: first,
    photoUrl,
    email: emailRaw,
    phone: phoneRaw,
    whatsappDigits,
    contactsUnlocked: true,
    unlockMessage: null,
  };
}
