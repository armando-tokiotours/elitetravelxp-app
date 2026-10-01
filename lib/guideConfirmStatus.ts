/**
 * Guide double-confirmation status helpers.
 * Uses guide_mode (legacy select) + guide_response (pending/accepted/refused).
 *
 * Golden rule (guest Day Services): confirmed Guide / Driver / Tickets
 * only surface as confirmed when ops_hub.payment_confirmed is true.
 */

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
 * Guest-facing label after golden rule:
 * confirmed name only when guide accepted AND payment confirmed.
 */
export function guideGuestDisplay(opts: {
  status: GuideConfirmStatus;
  guideName?: string | null;
  paymentConfirmed: boolean;
}): { name: string | null; label: string; showConfirmed: boolean } {
  const { status, guideName, paymentConfirmed } = opts;
  const name = String(guideName || "").trim() || null;

  if (status === "pending_guide_acceptance") {
    return {
      name: null,
      label: "Waiting for confirmation",
      showConfirmed: false,
    };
  }
  if (status === "guide_confirmed") {
    if (!paymentConfirmed) {
      return {
        name: null,
        label: "Waiting for payment confirmation",
        showConfirmed: false,
      };
    }
    return {
      name,
      label: name ? `Guide Confirmed: ${name}` : "Guide Confirmed",
      showConfirmed: true,
    };
  }
  return {
    name: null,
    label: guideConfirmClientLabel(status, name),
    showConfirmed: false,
  };
}

export function driverGuestDisplay(opts: {
  driverName?: string | null;
  driverNeeded: boolean;
  paymentConfirmed: boolean;
}): { name: string | null; label: string } {
  const name = String(opts.driverName || "").trim() || null;
  if (!opts.driverNeeded && !name) {
    return { name: null, label: "No driver assigned yet" };
  }
  if (!name) {
    return { name: null, label: "No driver assigned yet" };
  }
  if (!opts.paymentConfirmed) {
    return { name: null, label: "Waiting for payment confirmation" };
  }
  return { name, label: name };
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
