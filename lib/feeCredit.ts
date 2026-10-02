/**
 * Guest-side €60 Concierge Fee credit — separate from full tour payment.
 */

import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";

const key = (pnr: string) =>
  `tokiotours_concierge_fee_credit_${String(pnr || "")
    .trim()
    .toUpperCase()}`;

export function markConciergeFeePaid(
  pnr: string,
  amountEur: number = DEFAULT_CONCIERGE_FEE_EUR
): void {
  if (typeof window === "undefined") return;
  const ref = String(pnr || "").trim();
  if (!ref) return;
  try {
    window.sessionStorage.setItem(
      key(ref),
      String(Math.max(0, Math.round(amountEur)))
    );
  } catch {
    /* ignore */
  }
}

/** € credited from paid concierge fee (0 if not paid / unknown). */
export function getConciergeFeeCreditEur(pnr: string | null | undefined): number {
  if (typeof window === "undefined") return 0;
  const ref = String(pnr || "").trim();
  if (!ref) return 0;
  try {
    const raw = window.sessionStorage.getItem(key(ref));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Hydrate fee credit from ops (survives refresh / new tab), then cache in session.
 */
export async function hydrateConciergeFeeCredit(
  pnr: string | null | undefined
): Promise<number> {
  const ref = String(pnr || "").trim();
  if (!ref) return 0;
  const local = getConciergeFeeCreditEur(ref);
  try {
    const res = await fetch(
      `/api/bookings/concierge-fee?pnr=${encodeURIComponent(ref)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return local;
    const data = (await res.json()) as {
      feeCreditEur?: number;
      concierge_fee_paid?: boolean;
      deposit_amount?: number;
    };
    const fromServer = Math.max(
      0,
      Math.round(
        Number(data.feeCreditEur) ||
          (data.concierge_fee_paid
            ? Number(data.deposit_amount) || DEFAULT_CONCIERGE_FEE_EUR
            : 0)
      )
    );
    if (fromServer > 0) {
      markConciergeFeePaid(ref, fromServer);
      return fromServer;
    }
  } catch {
    /* keep local */
  }
  return local;
}

export function formatFeeCreditLine(creditEur: number, packageTotalEur: number) {
  const credit = Math.max(0, creditEur);
  const total = Math.max(0, packageTotalEur);
  const pending = Math.max(0, total - credit);
  return { credit, total, pending };
}
