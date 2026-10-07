/**
 * Guest-side €60 Concierge Fee credit — separate from full tour payment.
 */

import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";

const key = (pnr: string) =>
  `tokiotours_concierge_fee_credit_${String(pnr || "")
    .trim()
    .toUpperCase()}`;

const paidKey = (pnr: string) =>
  `tokiotours_total_paid_eur_${String(pnr || "")
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

export function markTotalPaidEur(pnr: string, amountEur: number): void {
  if (typeof window === "undefined") return;
  const ref = String(pnr || "").trim();
  if (!ref) return;
  try {
    window.sessionStorage.setItem(
      paidKey(ref),
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

export function getTotalPaidEurLocal(pnr: string | null | undefined): number {
  if (typeof window === "undefined") return 0;
  const ref = String(pnr || "").trim();
  if (!ref) return 0;
  try {
    const raw = window.sessionStorage.getItem(paidKey(ref));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

export type HydratedTourPayments = {
  feeCreditEur: number;
  totalPaidEur: number;
};

/**
 * Hydrate fee credit + total paid from ops (survives refresh / new tab).
 */
export async function hydrateTourPayments(
  pnr: string | null | undefined
): Promise<HydratedTourPayments> {
  const ref = String(pnr || "").trim();
  if (!ref) return { feeCreditEur: 0, totalPaidEur: 0 };
  const localFee = getConciergeFeeCreditEur(ref);
  const localPaid = getTotalPaidEurLocal(ref);
  try {
    const res = await fetch(
      `/api/bookings/concierge-fee?pnr=${encodeURIComponent(ref)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return {
        feeCreditEur: localFee,
        totalPaidEur: Math.max(localPaid, localFee),
      };
    }
    const data = (await res.json()) as {
      feeCreditEur?: number;
      totalPaidEur?: number;
      total_paid_eur?: number;
      amountPaid?: number;
      concierge_fee_paid?: boolean;
      deposit_amount?: number;
    };
    const fromServerFee = Math.max(
      0,
      Math.round(
        Number(data.feeCreditEur) ||
          (data.concierge_fee_paid
            ? Number(data.deposit_amount) || DEFAULT_CONCIERGE_FEE_EUR
            : 0)
      )
    );
    const fromServerPaid = Math.max(
      0,
      Math.round(
        Number(data.amountPaid) ||
          Number(data.totalPaidEur) ||
          Number(data.total_paid_eur) ||
          0
      )
    );
    const feeCreditEur = fromServerFee > 0 ? fromServerFee : localFee;
    const totalPaidEur = Math.max(
      fromServerPaid,
      localPaid,
      feeCreditEur
    );
    if (feeCreditEur > 0) markConciergeFeePaid(ref, feeCreditEur);
    if (totalPaidEur > 0) markTotalPaidEur(ref, totalPaidEur);
    return { feeCreditEur, totalPaidEur };
  } catch {
    return {
      feeCreditEur: localFee,
      totalPaidEur: Math.max(localPaid, localFee),
    };
  }
}

/**
 * Hydrate fee credit from ops (survives refresh / new tab), then cache in session.
 * Prefer `hydrateTourPayments` when you also need total paid.
 */
export async function hydrateConciergeFeeCredit(
  pnr: string | null | undefined
): Promise<number> {
  const { feeCreditEur } = await hydrateTourPayments(pnr);
  return feeCreditEur;
}

export function formatFeeCreditLine(creditEur: number, packageTotalEur: number) {
  const credit = Math.max(0, creditEur);
  const total = Math.max(0, packageTotalEur);
  const pending = Math.max(0, total - credit);
  return { credit, total, pending };
}
