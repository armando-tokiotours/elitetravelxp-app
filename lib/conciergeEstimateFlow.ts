/**
 * Concierge estimate + €60 risk-free deposit — defaults & branding helpers.
 */

import {
  fetchSiteBranding,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

export const DEFAULT_CONCIERGE_FEE_EUR = 60;

export type ConciergeEstimateCopy = {
  estimateModalTitle: string;
  estimatePerDaySubtext: string;
  feeAmountEur: number;
  feePolicyText: string;
  feeModalTitle: string;
  revolutPaymentUrl: string;
  optFullTitle: string;
  optFullSub: string;
  optFullHighlight: string;
  optPartialTitle: string;
  optPartialSub: string;
  optPartialHighlight: string;
  optLaterTitle: string;
  optLaterSub: string;
  seeDetailsLabel: string;
};

export const DEFAULT_CONCIERGE_ESTIMATE_COPY: ConciergeEstimateCopy = {
  estimateModalTitle: "Estimated Trip Cost",
  estimatePerDaySubtext:
    "Based on {pax} guests over {days} day(s) (Total: €{total})",
  feeAmountEur: DEFAULT_CONCIERGE_FEE_EUR,
  feeModalTitle: "Lock Your Dates & Dedicated Concierge",
  feePolicyText:
    "To hold your private guide and vehicle availability, a small €60 Deposit is required today. It is 100% credited toward your final tour balance. 100% flexible — change dates, routes, or stops anytime.",
  revolutPaymentUrl: "",
  optFullTitle: "1. LOCK IN FULL JOURNEY",
  optFullSub: "Secure your private guide, transport & itinerary.",
  optFullHighlight: "★ 100% Flexible: Adjust stops & dates anytime!",
  optPartialTitle: "2. BOOK SPECIFIC / PARTIAL SERVICES",
  optPartialSub: "Reserve only day tours, private drivers, or tickets.",
  optPartialHighlight: "★ Customize or add more experiences later.",
  optLaterTitle: "3. SAVE AS DRAFT & GET EMAIL COPY",
  optLaterSub: "Save your brief to review or fine-tune with your team.",
  seeDetailsLabel: "[ See Details & Flexible Breakdown ]",
};

/** Strip legacy non-refundable legalese from branding overrides. */
export function sanitizeDepositCopy(text: string): string {
  return String(text || "")
    .replace(/\s*Non-refundable once concierge deployment begins\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pick(row: PbSiteBranding | null, key: string, fallback: string): string {
  const v = row
    ? String((row as unknown as Record<string, unknown>)[key] || "").trim()
    : "";
  return v || fallback;
}

export function conciergeEstimateCopyFromBranding(
  row: PbSiteBranding | null
): ConciergeEstimateCopy {
  const feeRaw = pick(
    row,
    "concierge_fee_amount",
    String(DEFAULT_CONCIERGE_FEE_EUR)
  );
  const fee = Number(feeRaw);
  return {
    estimateModalTitle: pick(
      row,
      "estimate_modal_title",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.estimateModalTitle
    ),
    estimatePerDaySubtext: pick(
      row,
      "estimate_per_day_subtext",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.estimatePerDaySubtext
    ),
    feeAmountEur:
      Number.isFinite(fee) && fee > 0
        ? Math.round(fee)
        : DEFAULT_CONCIERGE_FEE_EUR,
    feeModalTitle: pick(
      row,
      "concierge_fee_modal_title",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.feeModalTitle
    ),
    feePolicyText: sanitizeDepositCopy(
      pick(
        row,
        "concierge_fee_policy_text",
        DEFAULT_CONCIERGE_ESTIMATE_COPY.feePolicyText
      )
    ),
    revolutPaymentUrl: pick(row, "revolut_payment_url", ""),
    optFullTitle: pick(
      row,
      "estimate_opt_full_title",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optFullTitle
    ),
    optFullSub: pick(
      row,
      "estimate_opt_full_sub",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optFullSub
    ),
    optFullHighlight: pick(
      row,
      "estimate_opt_full_highlight",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optFullHighlight
    ),
    optPartialTitle: pick(
      row,
      "estimate_opt_partial_title",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optPartialTitle
    ),
    optPartialSub: pick(
      row,
      "estimate_opt_partial_sub",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optPartialSub
    ),
    optPartialHighlight: pick(
      row,
      "estimate_opt_partial_highlight",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optPartialHighlight
    ),
    optLaterTitle: pick(
      row,
      "estimate_opt_later_title",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optLaterTitle
    ),
    optLaterSub: pick(
      row,
      "estimate_opt_later_sub",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.optLaterSub
    ),
    seeDetailsLabel: pick(
      row,
      "estimate_see_details_label",
      DEFAULT_CONCIERGE_ESTIMATE_COPY.seeDetailsLabel
    ),
  };
}

export async function loadConciergeEstimateCopy(): Promise<ConciergeEstimateCopy> {
  const row = await fetchSiteBranding();
  return conciergeEstimateCopyFromBranding(row);
}

/** Per-person / per-day framing (never show sticker-shock totals first). */
export function perPersonPerDayEur(
  totalPrice: number,
  paxCount: number,
  totalDays: number
): number {
  const pax = Math.max(1, Math.round(paxCount) || 1);
  const days = Math.max(1, Math.round(totalDays) || 1);
  const total = Math.max(0, Number(totalPrice) || 0);
  return Math.round(total / pax / days);
}

export function formatEstimateSubtext(
  template: string,
  opts: { pax: number; days: number; total: number }
): string {
  return template
    .replace(/\{pax\}/gi, String(opts.pax))
    .replace(/\{days\}/gi, String(opts.days))
    .replace(/\{total\}/gi, String(Math.round(opts.total)));
}

/** Tour start minus 3 months (YYYY-MM-DD). */
export function followupDateThreeMonthsBefore(
  startDate: string | null | undefined
): string | null {
  const raw = String(startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}
