/**
 * Guest dossier talk bubble — Concierge Deposit gate + in-app chat open event.
 * Unread badge: localStorage `comm-seen-${pnr}` = staff message count last read.
 */

import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";

export const GUEST_COMM_OPEN_EVENT = "tokiotours:open-guest-comm";

/**
 * Initial (empty-thread) greeting in guest chat, spoken by the actual
 * assigned concierge agent for the booking — display-only, never persisted.
 * Callers should only render it when an agent is assigned; with no agent
 * there is no greeting (no invented persona/name).
 */
export function assignedAgentGreeting(
  guestName?: string | null,
  agentName?: string | null
): string {
  const first = String(guestName || "").trim().split(/\s+/)[0] || "there";
  const agent = String(agentName || "").trim();
  if (!agent) {
    return `Hi ${first}, greetings! I am your TokioTours concierge agent. How can I help you today?`;
  }
  return `Hi ${first}, greetings! I am ${agent}, your TokioTours concierge agent. How can I help you today?`;
}

export type GuestCommOpenDetail = {
  pnr: string;
  guestEmail?: string;
  guestName?: string;
};

/** localStorage key: staff (agent|ops) message count marked as read for this PNR. */
export function commSeenKey(pnr: string): string {
  return `comm-seen-${String(pnr || "").trim()}`;
}

export function countStaffMessages(
  messages: { author_role?: string }[]
): number {
  return messages.filter(
    (m) => m.author_role === "agent" || m.author_role === "ops"
  ).length;
}

/** Read last-seen staff count from localStorage (migrates legacy sessionStorage). */
export function getCommSeenStaffCount(pnr: string): number {
  if (typeof window === "undefined") return 0;
  const key = commSeenKey(pnr);
  if (!String(pnr || "").trim()) return 0;
  try {
    const local = window.localStorage.getItem(key);
    if (local != null) return Math.max(0, Number(local) || 0);
    const session = window.sessionStorage.getItem(key);
    if (session != null) {
      const n = Math.max(0, Number(session) || 0);
      window.localStorage.setItem(key, String(n));
      window.sessionStorage.removeItem(key);
      return n;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Persist last-seen staff count — call only when the guest explicitly opens chat. */
export function setCommSeenStaffCount(pnr: string, staffCount: number): void {
  const ref = String(pnr || "").trim();
  if (!ref || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      commSeenKey(ref),
      String(Math.max(0, Math.floor(staffCount)))
    );
  } catch {
    /* ignore */
  }
}

export function countUnreadStaffMessages(
  pnr: string,
  messages: { author_role?: string }[]
): number {
  return Math.max(0, countStaffMessages(messages) - getCommSeenStaffCount(pnr));
}

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
