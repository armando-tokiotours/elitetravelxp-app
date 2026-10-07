/**
 * Guest dossier talk bubble — Concierge Deposit gate + in-app chat open event.
 */

import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";

export const GUEST_COMM_OPEN_EVENT = "tokiotours:open-guest-comm";

export type GuestCommOpenDetail = {
  pnr: string;
  guestEmail?: string;
  guestName?: string;
};

export function isGuestTalkUnlocked(input: {
  feeCreditEur?: number | null;
  totalPaidEur?: number | null;
  conciergeFeeEur?: number | null;
  concierge_fee_paid?: boolean | null;
}): boolean {
  if (Boolean(input.concierge_fee_paid)) return true;
  const fee = Math.max(
    0,
    Math.round(Number(input.conciergeFeeEur) || DEFAULT_CONCIERGE_FEE_EUR)
  );
  const credit = Math.max(0, Math.round(Number(input.feeCreditEur) || 0));
  const paid = Math.max(0, Math.round(Number(input.totalPaidEur) || 0));
  return credit > 0 || paid >= fee;
}

/** Open the on-page guest chat modal (listened by GuestTalkBubble). */
export function requestGuestCommOpen(detail: GuestCommOpenDetail): void {
  if (typeof window === "undefined") return;
  const pnr = String(detail.pnr || "").trim();
  if (!pnr) return;
  window.dispatchEvent(
    new CustomEvent(GUEST_COMM_OPEN_EVENT, {
      detail: {
        pnr,
        guestEmail: String(detail.guestEmail || "").trim() || undefined,
        guestName: String(detail.guestName || "").trim() || undefined,
      } satisfies GuestCommOpenDetail,
    })
  );
}
