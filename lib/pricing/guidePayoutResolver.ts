/**
 * Guide payout: three fee sources → assignment snapshot → ops_money / ops_payouts.
 */

import type PocketBase from "pocketbase";
import { updateMoneyByPnr } from "@/lib/opsMoney";
import { upsertPayout } from "@/lib/opsPayouts";

export type FeeSource =
  | "guide_card_default"
  | "tour_standard"
  | "manual_override";

export type CalculateGuidePayoutParams = {
  pnr: string;
  guideId: string;
  tourId?: string;
  tourDate?: string;
  durationHours: number;
  guestCount?: number;
  retailPriceClient: number;
  currency: "EUR" | "JPY";
  selectedSource: FeeSource;
  manualFeeOverride?: number;
  manualExpensesOverride?: number;
};

export type GuidePayoutResult = {
  assignmentId: string;
  resolvedFee: number;
  resolvedExpenses: number;
  totalPayout: number;
  netMargin: number;
  feeSource: FeeSource;
};

type GuideCard = {
  id: string;
  staff?: string;
  full_name?: string;
  base_rate_6h_or_less?: number;
  base_rate_8h_or_less?: number;
  extra_head_percentage?: number;
  fee_min?: number;
  fee_max?: number;
};

type TourRate = {
  standard_fee_6h?: number;
  standard_fee_8h?: number;
  default_expenses?: number;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function feeForHours(hours: number, six: number, eight: number): number {
  if (hours <= 6) return six;
  return eight > 0 ? eight : six;
}

function applyExtraHeads(base: number, guests: number, pct: number): number {
  if (base <= 0 || pct <= 0) return base;
  const extra = Math.max(0, Math.floor(guests) - 2);
  if (extra <= 0) return base;
  return Math.round(base * (1 + (extra * pct) / 100));
}

function clampFee(fee: number, min?: number, max?: number): number {
  let v = fee;
  if (min != null && min > 0) v = Math.max(v, min);
  if (max != null && max > 0) v = Math.min(v, max);
  return v;
}

async function findTourRate(
  pb: PocketBase,
  tourId: string,
  guideId: string
): Promise<TourRate | null> {
  try {
    return await pb.collection("guide_tour_rates").getFirstListItem<TourRate>(
      `tour="${tourId}" && guide="${guideId}"`,
      { requestKey: null }
    );
  } catch {
    /* try universal */
  }
  try {
    return await pb.collection("guide_tour_rates").getFirstListItem<TourRate>(
      `tour="${tourId}" && guide=""`,
      { requestKey: null }
    );
  } catch {
    /* pocketbase empty relation filters vary — try without guide clause */
  }
  try {
    const rows = await pb.collection("guide_tour_rates").getFullList<
      TourRate & { guide?: string }
    >({
      filter: `tour="${tourId}"`,
      requestKey: null,
    });
    const specific = rows.find((r) => r.guide === guideId);
    if (specific) return specific;
    const universal = rows.find((r) => !r.guide);
    return universal || rows[0] || null;
  } catch {
    return null;
  }
}

export async function resolveAndSaveGuideAssignment(
  pb: PocketBase,
  params: CalculateGuidePayoutParams
): Promise<GuidePayoutResult> {
  const pnr = String(params.pnr || "")
    .trim()
    .toUpperCase();
  if (!pnr || !params.guideId) {
    throw new Error("pnr and guideId required");
  }

  const guide = await pb
    .collection("guides")
    .getOne<GuideCard>(params.guideId, { requestKey: null });

  let resolvedFee = 0;
  let resolvedExpenses = 0;
  const hours = Math.max(0, Number(params.durationHours) || 0);
  const guests = Math.max(0, Number(params.guestCount) || 0);
  const pct = n(guide.extra_head_percentage);

  if (params.selectedSource === "manual_override") {
    resolvedFee = clampFee(
      n(params.manualFeeOverride),
      guide.fee_min,
      guide.fee_max
    );
    resolvedExpenses = Math.max(0, n(params.manualExpensesOverride));
  } else if (params.selectedSource === "tour_standard" && params.tourId) {
    const tourRate = await findTourRate(pb, params.tourId, params.guideId);
    if (tourRate) {
      resolvedFee = applyExtraHeads(
        feeForHours(
          hours,
          n(tourRate.standard_fee_6h),
          n(tourRate.standard_fee_8h)
        ),
        guests,
        pct
      );
      resolvedExpenses = Math.max(0, n(tourRate.default_expenses));
    } else {
      resolvedFee = applyExtraHeads(
        feeForHours(
          hours,
          n(guide.base_rate_6h_or_less),
          n(guide.base_rate_8h_or_less)
        ),
        guests,
        pct
      );
    }
  } else {
    resolvedFee = applyExtraHeads(
      feeForHours(
        hours,
        n(guide.base_rate_6h_or_less),
        n(guide.base_rate_8h_or_less)
      ),
      guests,
      pct
    );
  }

  const retail = Math.max(0, n(params.retailPriceClient));
  const totalPayout = resolvedFee + resolvedExpenses;
  const netMargin = retail - totalPayout;
  const staffId = String(guide.staff || "").trim();

  const assignment = await pb.collection("itinerary_guide_assignments").create(
    {
      pnr,
      assigned_guide: params.guideId,
      staff_id: staffId,
      tour: params.tourId || "",
      tour_date: params.tourDate || "",
      tour_duration_hours: hours,
      guest_count: guests,
      retail_price_client: retail,
      fee_source: params.selectedSource,
      guide_fee_amount: resolvedFee,
      guide_expenses_amount: resolvedExpenses,
      total_guide_payout: totalPayout,
      tokiotours_net_margin: netMargin,
      currency: params.currency,
      payout_status: "pending_tour",
    },
    { requestKey: null }
  );

  // Roll up guide pay for this PNR
  try {
    const all = await pb
      .collection("itinerary_guide_assignments")
      .getFullList<{ total_guide_payout?: number }>({
        filter: `pnr="${pnr}"`,
        requestKey: null,
      });
    const sum = all.reduce((s, r) => s + n(r.total_guide_payout), 0);
    await updateMoneyByPnr(pb, pnr, { guide_pay_jpy: sum });
  } catch {
    /* money pocket optional */
  }

  if (staffId) {
    try {
      await upsertPayout(pb, {
        pnr,
        staffId,
        staffName: guide.full_name || "",
        role: "guide",
        amountJpy: totalPayout,
        status: "pending",
      });
    } catch {
      /* */
    }
  }

  return {
    assignmentId: assignment.id,
    resolvedFee,
    resolvedExpenses,
    totalPayout,
    netMargin,
    feeSource: params.selectedSource,
  };
}
