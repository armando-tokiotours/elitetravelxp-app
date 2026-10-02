/**
 * Ops Financial & Payment Audit — base total + 30% progress milestone math.
 */

import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { roundEur } from "@/lib/balanceSettlement";

export type OpsFinancialAudit = {
  realBaseTotal: number;
  conciergeFeePaid: boolean;
  conciergeFeeAmount: number;
  totalPaidToDate: number;
  remainingDue: number;
  /** 30% of (base − fee) */
  target30PercentAmount: number;
  /** Fee + 30% progress (cumulative cash needed for milestone) */
  totalNeededFor30Percent: number;
  netAfterFee: number;
  is30PercentThresholdMet: boolean;
  isFullySettled: boolean;
};

function pickPositive(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return roundEur(n);
  }
  return 0;
}

/** Pull a package € total from nested JSON (selections / itinerary payload). */
export function extractPackageTotalFromRecord(
  raw: Record<string, unknown> | null | undefined
): number {
  if (!raw || typeof raw !== "object") return 0;

  const direct = pickPositive(
    raw.estimated_total_eur,
    raw.estimated_total,
    raw.estimatedTotal,
    raw.estimatedTotalEur,
    raw.base_quote_eur,
    raw.baseQuoteEur,
    raw.package_total_eur,
    raw.packageTotalEur,
    raw.quote_max,
    raw.quoteMax,
    raw.total_eur,
    raw.totalEur
  );
  if (direct > 0) return direct;

  const quote = raw.quote;
  if (quote && typeof quote === "object") {
    const q = quote as Record<string, unknown>;
    const fromQuote = pickPositive(q.max, q.totalEur, q.total, q.maxEur);
    if (fromQuote > 0) return fromQuote;
  }

  const selections = raw.selections;
  if (selections && typeof selections === "object") {
    const fromSel = extractPackageTotalFromRecord(
      selections as Record<string, unknown>
    );
    if (fromSel > 0) return fromSel;
  }

  const services = raw.selected_services || raw.services || raw.cart;
  if (Array.isArray(services) && services.length > 0) {
    const sum = services.reduce((acc: number, s: unknown) => {
      if (!s || typeof s !== "object") return acc;
      const row = s as Record<string, unknown>;
      return (
        acc +
        pickPositive(
          row.estimatedEur,
          row.price,
          row.priceEur,
          row.amountEur,
          row.totalEur
        )
      );
    }, 0);
    if (sum > 0) return roundEur(sum);
  }

  // Builder E itinerary_data may be a JSON string
  const itinerary = raw.itinerary_data;
  if (typeof itinerary === "string" && itinerary.trim().startsWith("{")) {
    try {
      return extractPackageTotalFromRecord(
        JSON.parse(itinerary) as Record<string, unknown>
      );
    } catch {
      /* ignore */
    }
  }
  if (itinerary && typeof itinerary === "object") {
    return extractPackageTotalFromRecord(
      itinerary as Record<string, unknown>
    );
  }

  return 0;
}

/**
 * Resolve internal base total from ops_hub cache, then PNR detail records.
 * Never invents a fake quote — returns 0 only when nothing is on the server.
 */
export async function resolveOpsRealBaseTotal(
  pb: PocketBase,
  row: Pick<
    OpsHubRow,
    "pnr" | "estimated_total_eur" | "detail_id" | "detail_collection" | "source"
  >
): Promise<number> {
  const cached = pickPositive(row.estimated_total_eur);
  if (cached > 0) return cached;

  const pnr = String(row.pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!pnr) return 0;

  // 1) bookings_and_leads (Builder M / S / E pointer)
  try {
    const bal = await pb.collection("bookings_and_leads").getFirstListItem(
      `booking_ref="${pnr}"`,
      { requestKey: null }
    );
    const fromBal = extractPackageTotalFromRecord(
      bal as unknown as Record<string, unknown>
    );
    if (fromBal > 0) return fromBal;
  } catch {
    /* try next */
  }

  // 2) Classic booking_requests (quote_max)
  try {
    const req = await pb.collection("booking_requests").getFirstListItem(
      `booking_ref="${pnr}" || pnr="${pnr}"`,
      { requestKey: null }
    );
    const fromReq = extractPackageTotalFromRecord(
      req as unknown as Record<string, unknown>
    );
    if (fromReq > 0) return fromReq;
  } catch {
    /* try next */
  }

  // 3) bookings (Builder E EXPERIENCE_ONLY itinerary_data)
  try {
    const booking = await pb
      .collection("bookings")
      .getFirstListItem(`booking_ref="${pnr}"`, { requestKey: null });
    const fromBooking = extractPackageTotalFromRecord(
      booking as unknown as Record<string, unknown>
    );
    if (fromBooking > 0) return fromBooking;
  } catch {
    /* optional */
  }

  return 0;
}

export function computeOpsFinancialAudit(input: {
  realBaseTotal: number;
  conciergeFeePaid?: boolean;
  conciergeFeeAmount?: number;
  totalPaidEur?: number;
}): OpsFinancialAudit {
  const realBaseTotal = roundEur(input.realBaseTotal);
  const conciergeFeePaid = Boolean(input.conciergeFeePaid);
  const conciergeFeeAmount = roundEur(
    input.conciergeFeeAmount && input.conciergeFeeAmount > 0
      ? input.conciergeFeeAmount
      : 60
  );
  const totalPaidToDate = roundEur(
    input.totalPaidEur != null && Number(input.totalPaidEur) > 0
      ? Number(input.totalPaidEur)
      : conciergeFeePaid
        ? conciergeFeeAmount
        : 0
  );
  const remainingDue =
    realBaseTotal > 0
      ? Math.max(0, realBaseTotal - totalPaidToDate)
      : 0;
  const netAfterFee = Math.max(0, realBaseTotal - conciergeFeeAmount);
  const target30PercentAmount = Math.round(netAfterFee * 0.3);
  const totalNeededFor30Percent =
    target30PercentAmount + conciergeFeeAmount;
  const isFullySettled =
    realBaseTotal > 0 && remainingDue <= 0 && totalPaidToDate > 0;
  const is30PercentThresholdMet =
    realBaseTotal > 0 &&
    totalPaidToDate >= totalNeededFor30Percent;

  return {
    realBaseTotal,
    conciergeFeePaid,
    conciergeFeeAmount,
    totalPaidToDate,
    remainingDue,
    target30PercentAmount,
    totalNeededFor30Percent,
    netAfterFee,
    is30PercentThresholdMet,
    isFullySettled,
  };
}
