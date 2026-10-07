/**
 * Guide double-confirmation status helpers.
 * Uses guide_mode (legacy select) + guide_response (pending/accepted/refused).
 *
 * Guest Day Services: guide name may show (first name) after guide accepts;
 * full contact (surname / email / phone) stays gated by guideContactsUnlocked
 * (confirmed booking + fully paid) — see lib/guidePrivacy.ts.
 */

import { firstNameOnly, GUIDE_CONTACT_UNLOCK_MSG } from "@/lib/guidePrivacy";

export type GuideConfirmStatus =
  | "unassigned"
  | "pending_guide_acceptance"
  | "posted_open_board"
  | "guide_confirmed"
  | "refused";

export type GuideResponse = "none" | "pending" | "accepted" | "refused";

export type GuideDispatchMode = "unassigned" | "direct" | "open" | "claimed";

export function normalizeGuideResponse(raw?: string | null): GuideResponse {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "pending" || v === "accepted" || v === "refused") return v;
  return "none";
}

export function normalizeGuideConfirmStatus(
  mode?: string | null,
  opts?: {
    boardVisible?: boolean;
    assignedGuideId?: string | null;
    guideResponse?: string | null;
  }
): GuideConfirmStatus {
  const response = normalizeGuideResponse(opts?.guideResponse);
  if (response === "pending") return "pending_guide_acceptance";
  if (response === "refused") return "refused";
  if (response === "accepted") return "guide_confirmed";

  const m = String(mode || "")
    .trim()
    .toLowerCase();
  const hasGuide = Boolean(String(opts?.assignedGuideId || "").trim());

  if (m === "pending_guide_acceptance") return "pending_guide_acceptance";
  if (m === "guide_confirmed") return "guide_confirmed";
  if (m === "posted_open_board") return "posted_open_board";

  if (m === "claimed") return "guide_confirmed";
  if (
    m === "open" ||
    (opts?.boardVisible && !hasGuide)
  ) {
    return "posted_open_board";
  }
  // Sent for approval (direct + assigned) until guide_response=accepted
  if (m === "direct" && hasGuide) return "pending_guide_acceptance";
  return "unassigned";
}

export function guideConfirmStaffLabel(status: GuideConfirmStatus): string {
  switch (status) {
    case "pending_guide_acceptance":
      return "Sent — Pending Guide Approval";
    case "posted_open_board":
      return "Posted on Open Board";
    case "guide_confirmed":
      return "Confirmed by Guide";
    case "refused":
      return "Guide Refused — Reassign";
    default:
      return "Unassigned";
  }
}

/** Guest Day Services copy (before payment gate). */
export function guideConfirmClientLabel(
  status: GuideConfirmStatus,
  guideName?: string | null
): string {
  const name = String(guideName || "").trim();
  switch (status) {
    case "pending_guide_acceptance":
      return "Waiting for confirmation";
    case "posted_open_board":
      return "Guide: Posted on Open Board";
    case "guide_confirmed":
      return name ? `Guide Confirmed: ${name}` : "Guide Confirmed";
    case "refused":
      return "No guide assigned yet";
    default:
      return "No guide assigned yet";
  }
}

/**
 * Guest-facing guide label after acceptance + privacy gate.
 * Before contacts unlock: first name only + unlock message.
 * Prefer opts.firstName (staff_profiles.first_name) over token-splitting guideName.
 */
export function guideGuestDisplay(opts: {
  status: GuideConfirmStatus;
  guideName?: string | null;
  /** Preferred: staff_profiles.first_name */
  firstName?: string | null;
  /** Prefer contactsUnlocked; paymentConfirmed kept as legacy fallback. */
  paymentConfirmed?: boolean;
  contactsUnlocked?: boolean;
}): {
  name: string | null;
  label: string;
  showConfirmed: boolean;
  unlockMessage: string | null;
} {
  const { status, guideName } = opts;
  const unlocked =
    opts.contactsUnlocked ?? Boolean(opts.paymentConfirmed);
  const full = String(guideName || "").trim() || null;
  const first =
    String(opts.firstName || "").trim() || firstNameOnly(full) || null;

  if (status === "pending_guide_acceptance") {
    return {
      name: null,
      label: "Waiting for confirmation",
      showConfirmed: false,
      unlockMessage: null,
    };
  }
  if (status === "guide_confirmed") {
    if (!unlocked) {
      return {
        name: first,
        label: first ? `Guide: ${first}` : "Guide assigned",
        showConfirmed: Boolean(first),
        unlockMessage: GUIDE_CONTACT_UNLOCK_MSG,
      };
    }
    return {
      name: full,
      label: full ? `Guide Confirmed: ${full}` : "Guide Confirmed",
      showConfirmed: true,
      unlockMessage: null,
    };
  }
  return {
    name: null,
    label: guideConfirmClientLabel(status, full),
    showConfirmed: false,
    unlockMessage: null,
  };
}

export function driverGuestDisplay(opts: {
  driverName?: string | null;
  /** Preferred: staff_profiles.first_name */
  firstName?: string | null;
  driverNeeded: boolean;
  paymentConfirmed?: boolean;
  contactsUnlocked?: boolean;
}): {
  name: string | null;
  label: string;
  unlockMessage: string | null;
} {
  const unlocked =
    opts.contactsUnlocked ?? Boolean(opts.paymentConfirmed);
  const full = String(opts.driverName || "").trim() || null;
  const first =
    String(opts.firstName || "").trim() || firstNameOnly(full) || null;
  if (!opts.driverNeeded && !full) {
    return { name: null, label: "No driver assigned yet", unlockMessage: null };
  }
  if (!full) {
    return { name: null, label: "No driver assigned yet", unlockMessage: null };
  }
  if (!unlocked) {
    return {
      name: first,
      label: first || "Driver assigned",
      unlockMessage: GUIDE_CONTACT_UNLOCK_MSG,
    };
  }
  return { name: full, label: full, unlockMessage: null };
}

export function isGuideBoardOpen(
  mode?: string | null,
  boardVisible?: boolean
): boolean {
  const m = String(mode || "")
    .trim()
    .toLowerCase();
  if (m === "posted_open_board" || m === "open") return true;
  return Boolean(boardVisible);
}

export function isGuidePendingAcceptance(
  mode?: string | null,
  guideResponse?: string | null
): boolean {
  if (normalizeGuideResponse(guideResponse) === "pending") return true;
  const m = String(mode || "")
    .trim()
    .toLowerCase();
  if (m === "pending_guide_acceptance") return true;
  // direct + pending response missing but still awaiting accept
  if (m === "direct" && normalizeGuideResponse(guideResponse) === "none") {
    return true; // treated pending until accepted (claimed)
  }
  return false;
}

export function isGuideConfirmed(
  mode?: string | null,
  guideResponse?: string | null
): boolean {
  return (
    normalizeGuideConfirmStatus(mode, { guideResponse }) === "guide_confirmed"
  );
}
