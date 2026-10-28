/**
 * Isolated Single-Day (Builder S) package pricing — never uses multi-day quote math.
 *
 * Money comes from:
 * - Selected tours / experiences (catalog prices — e.g. City Tour 6h already includes the tour)
 * - Transit only when chosen (Suica preload, walk €0, private chauffeur package)
 * - Optional concierge fee
 *
 * guidePreference is Ops preference only — NOT a separate invoice charge.
 */

import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import type {
  GuidePreference,
  IntraCityTransport,
} from "@/store/useSingleDayBuilderStore";

export {
  TOUR_HOURS_CUSTOM_MIN,
  TOUR_HOURS_CUSTOM_MAX,
  resolveTourHoursTier,
  clampCustomTourHours,
} from "@/lib/tourHoursTier";

/** Approx. display FX for Yen companion line (EUR → JPY). */
export const SINGLE_DAY_EUR_TO_JPY = 160;

/** Private chauffeur package estimate when movement = private_driver. */
const PRIVATE_CHAUFFEUR_FLAT_EUR = 160;

export type SingleDayInvoiceLine = {
  id: string;
  label: string;
  amountEur: number;
};

export type SingleDayQuote = {
  lines: SingleDayInvoiceLine[];
  experiencesSubtotal: number;
  /** @deprecated use transitSubtotal — kept for callers */
  transitGuideSubtotal: number;
  transitSubtotal: number;
  /** Always 0 — guide is inside tour catalog price */
  guideSubtotal: number;
  conciergeFee: number;
  totalEur: number;
  totalYen: number;
  min: number;
  max: number;
};

export type SingleDayTransitInput = {
  preferredMovement?: IntraCityTransport | null;
  suicaNeeded?: boolean;
  suicaValueEur?: number;
  /** Adults + children — Suica preload is per guest. */
  guests?: number;
};

function resolveTransitLine(
  input: SingleDayTransitInput
): SingleDayInvoiceLine | null {
  const movement = input.preferredMovement ?? null;
  const guests = Math.max(1, Math.round(Number(input.guests) || 1));

  if (movement === "walk") {
    return {
      id: "transit",
      label: "Walking / neighborhood pace (no transit fee)",
      amountEur: 0,
    };
  }

  if (movement === "subway") {
    if (input.suicaNeeded) {
      const per = Math.max(0, Number(input.suicaValueEur) || 15);
      const total = Math.round(per * guests);
      return {
        id: "transit",
        label: `Suica / PASMO preload estimate (€${per} × ${guests} guest${guests === 1 ? "" : "s"})`,
        amountEur: total,
      };
    }
    return {
      id: "transit",
      label: "Subway / IC — guest has own card (no Suica fee)",
      amountEur: 0,
    };
  }

  if (movement === "private_driver") {
    return {
      id: "transit",
      label: "Private chauffeur package estimate (1 day)",
      amountEur: PRIVATE_CHAUFFEUR_FLAT_EUR,
    };
  }

  if (movement === "mix") {
    const chauffeur = PRIVATE_CHAUFFEUR_FLAT_EUR;
    if (input.suicaNeeded) {
      const per = Math.max(0, Number(input.suicaValueEur) || 15);
      const suica = Math.round(per * guests);
      return {
        id: "transit",
        label: `Mix · chauffeur estimate + Suica preload (€${per} × ${guests})`,
        amountEur: chauffeur + suica,
      };
    }
    return {
      id: "transit",
      label: "Mix · private transfers + public rail (chauffeur estimate)",
      amountEur: chauffeur,
    };
  }

  // No movement chosen — omit transit line (don't invent private transit)
  return null;
}

export function calculateSingleDayQuote(input: {
  guidePreference: GuidePreference;
  tourHours: number;
  experiencePrices: number[];
  conciergeActive?: boolean;
  preferredMovement?: IntraCityTransport | null;
  suicaNeeded?: boolean;
  suicaValueEur?: number;
  guests?: number;
}): SingleDayQuote {
  const lines: SingleDayInvoiceLine[] = [];

  const transitLine = resolveTransitLine({
    preferredMovement: input.preferredMovement,
    suicaNeeded: input.suicaNeeded,
    suicaValueEur: input.suicaValueEur,
    guests: input.guests,
  });
  if (transitLine) {
    lines.push(transitLine);
  }

  const experiencePrices = (input.experiencePrices || []).filter(
    (n) => Number.isFinite(n) && n > 0
  );
  const experiencesSubtotal = experiencePrices.reduce((s, n) => s + n, 0);
  if (experiencesSubtotal > 0) {
    lines.push({
      id: "experiences",
      label: "Selected tours & experiences",
      amountEur: experiencesSubtotal,
    });
  }

  const conciergeFee = input.conciergeActive ? ELITE_CONCIERGE_FEE : 0;
  if (conciergeFee > 0) {
    lines.push({
      id: "concierge",
      label: "Concierge Service",
      amountEur: conciergeFee,
    });
  }

  const transitSubtotal = transitLine?.amountEur ?? 0;
  const guideSubtotal = 0;
  const totalEur = lines.reduce((s, l) => s + l.amountEur, 0);
  const totalYen = Math.round(totalEur * SINGLE_DAY_EUR_TO_JPY);

  return {
    lines,
    experiencesSubtotal,
    transitGuideSubtotal: transitSubtotal,
    transitSubtotal,
    guideSubtotal,
    conciergeFee,
    totalEur,
    totalYen,
    min: totalEur,
    max: totalEur,
  };
}

/** Matches invoice contingency when Ops line has no estimateMaxEur. */
const OPS_ESTIMATE_CONTINGENCY = 1.3;

/** Ops / invoice lock snapshot (agent_services + final_approved_price). */
export type LockedAdminPricingSnapshot = {
  services?: Array<{
    id?: string;
    title?: string;
    category?: string;
    finalPriceEur?: number;
    basePriceEur?: number;
    /** Estimate ceiling (Ops Pricing Studio); typically ≈ final × 1.3 */
    estimateMaxEur?: number;
    status?: string;
    isBonus?: boolean;
    quantity?: number;
  }> | null;
  finalApprovedPrice?: number | null;
  estimatedTotalEur?: number | null;
  priceMode?: string | null;
};

function acceptedLockLines(lock: LockedAdminPricingSnapshot) {
  return (lock.services || []).filter((row) => {
    if (!row || row.isBonus) return false;
    const status = String(row.status || "ACCEPTED")
      .trim()
      .toUpperCase();
    if (status !== "ACCEPTED") return false;
    const title = String(row.title || "").trim();
    return Boolean(title);
  });
}

function lineAmountEur(row: NonNullable<LockedAdminPricingSnapshot["services"]>[number]) {
  const qty = Math.max(1, Math.round(Number(row.quantity) || 1));
  const unit = Number.isFinite(Number(row.finalPriceEur))
    ? Math.max(0, Math.round(Number(row.finalPriceEur)))
    : Math.max(0, Math.round(Number(row.basePriceEur) || 0));
  return unit * qty;
}

/** Per-line estimate ceiling (same rules as invoicePackageRangeEur). */
function lineMaxAmountEur(
  row: NonNullable<LockedAdminPricingSnapshot["services"]>[number]
) {
  const qty = Math.max(1, Math.round(Number(row.quantity) || 1));
  const minUnit = Number.isFinite(Number(row.finalPriceEur))
    ? Math.max(0, Math.round(Number(row.finalPriceEur)))
    : Math.max(0, Math.round(Number(row.basePriceEur) || 0));
  const maxUnit =
    row.estimateMaxEur != null && Number.isFinite(Number(row.estimateMaxEur))
      ? Math.max(minUnit, Math.round(Number(row.estimateMaxEur)))
      : Math.round(minUnit * OPS_ESTIMATE_CONTINGENCY);
  return maxUnit * qty;
}

/** True when guest should see a firm single figure (Exact Real Price / deal lock). */
export function isExactOpsGuestPricing(
  lock: LockedAdminPricingSnapshot | null | undefined
): boolean {
  if (!lock) return false;
  const approved = Number(lock.finalApprovedPrice);
  if (Number.isFinite(approved) && approved > 0) return true;
  return String(lock.priceMode || "").trim().toLowerCase() === "exact";
}

/** Ops Pricing Studio cart exists (estimate or exact). */
export function hasOpsServiceCart(
  lock: LockedAdminPricingSnapshot | null | undefined
): boolean {
  if (!lock) return false;
  if (acceptedLockLines(lock).length > 0) return true;
  const approved = Number(lock.finalApprovedPrice);
  return Number.isFinite(approved) && approved > 0;
}

function classifyLockCategory(category: string | undefined): "transit" | "experiences" | "concierge" {
  const c = String(category || "")
    .trim()
    .toUpperCase();
  if (
    c === "TRANSPORT" ||
    c.includes("TRANSIT") ||
    c.includes("TRANSFER") ||
    c.includes("SUBWAY") ||
    c.includes("SUICA")
  ) {
    return "transit";
  }
  if (c === "CONCIERGE_EXTRA" || c.includes("CONCIERGE")) {
    return "concierge";
  }
  return "experiences";
}

/**
 * True when Ops has an exact / approved package lock (firm single figure).
 * Estimate-range carts are handled separately via hasOpsServiceCart.
 */
export function hasLockedAdminPricing(
  lock: LockedAdminPricingSnapshot | null | undefined
): boolean {
  if (!lock) return false;
  if (!isExactOpsGuestPricing(lock)) return false;
  const approved = Number(lock.finalApprovedPrice);
  if (Number.isFinite(approved) && approved > 0) return true;
  return acceptedLockLines(lock).length > 0;
}

/**
 * Prefer Ops Pricing Studio figures (estimate range or exact) once the
 * booking is past draft, or whenever a deal-lock / exact cart exists.
 */
export function shouldPreferLockedSingleDayQuote(opts: {
  bookingStatus?: string | null;
  confirmedBookingRef?: string | null;
  lock?: LockedAdminPricingSnapshot | null;
}): boolean {
  if (!hasOpsServiceCart(opts.lock)) return false;
  const status = String(opts.bookingStatus || "")
    .trim()
    .toLowerCase();
  const isDraft =
    !status ||
    status === "draft" ||
    status === "pre_qualification";
  if (!isDraft) return true;
  // Edge: exact / approved package already set even if UI status still draft
  return isExactOpsGuestPricing(opts.lock);
}

/** Build a SingleDayQuote from Ops line items / approved total (estimate or exact). */
export function buildLockedSingleDayQuote(
  lock: LockedAdminPricingSnapshot
): SingleDayQuote | null {
  const rows = acceptedLockLines(lock);
  const lines: SingleDayInvoiceLine[] = rows.map((row, idx) => {
    const qty = Math.max(1, Math.round(Number(row.quantity) || 1));
    const title = String(row.title || "").trim();
    return {
      id: String(row.id || `lock-${idx}`),
      label: qty > 1 ? `${title} ×${qty}` : title,
      amountEur: lineAmountEur(row),
    };
  });

  const linesSum = lines.reduce((s, l) => s + l.amountEur, 0);
  const linesMaxSum = rows.reduce((s, row) => s + lineMaxAmountEur(row), 0);
  const approved = Number(lock.finalApprovedPrice);
  const estimated = Number(lock.estimatedTotalEur);
  const exactMode = isExactOpsGuestPricing(lock);

  let totalEur = 0;
  if (Number.isFinite(approved) && approved > 0) {
    totalEur = Math.round(approved);
  } else if (linesSum > 0) {
    totalEur = linesSum;
  } else if (Number.isFinite(estimated) && estimated > 0) {
    totalEur = Math.round(estimated);
  } else {
    return null;
  }

  if (lines.length === 0) {
    lines.push({
      id: "approved-package",
      label: exactMode ? "Approved package" : "Estimated package",
      amountEur: totalEur,
    });
  } else if (
    Number.isFinite(approved) &&
    approved > 0 &&
    Math.abs(linesSum - totalEur) > 0
  ) {
    // Keep real Ops lines; bridge any deal-lock delta so composition == approved total
    lines.push({
      id: "deal-adjustment",
      label: "Approved package adjustment",
      amountEur: totalEur - linesSum,
    });
  }

  let transitSubtotal = 0;
  let experiencesSubtotal = 0;
  let conciergeFee = 0;
  for (const row of rows) {
    const amount = lineAmountEur(row);
    const kind = classifyLockCategory(row.category);
    if (kind === "transit") transitSubtotal += amount;
    else if (kind === "concierge") conciergeFee += amount;
    else experiencesSubtotal += amount;
  }
  if (rows.length === 0) {
    experiencesSubtotal = totalEur;
  }

  // Exact / deal-lock → single figure. Estimate Range → min–max from line ceilings.
  let min = totalEur;
  let max = totalEur;
  if (!exactMode) {
    min = linesSum > 0 ? linesSum : totalEur;
    max = Math.max(
      min,
      linesMaxSum > 0
        ? linesMaxSum
        : Number.isFinite(estimated) && estimated > min
          ? Math.round(estimated)
          : Math.round(min * OPS_ESTIMATE_CONTINGENCY)
    );
  }

  const totalYen = Math.round(totalEur * SINGLE_DAY_EUR_TO_JPY);
  return {
    lines,
    experiencesSubtotal,
    transitGuideSubtotal: transitSubtotal,
    transitSubtotal,
    guideSubtotal: 0,
    conciergeFee,
    totalEur,
    totalYen,
    min,
    max,
  };
}

export type SingleDayDisplayQuote = {
  quote: SingleDayQuote;
  /** True only for Exact Real Price / deal-lock (not estimate-range carts). */
  locked: boolean;
};

/** Dynamic catalog estimate, or Ops Pricing Studio package when applicable. */
export function resolveSingleDayDisplayQuote(
  dynamicInput: Parameters<typeof calculateSingleDayQuote>[0],
  opts?: {
    bookingStatus?: string | null;
    confirmedBookingRef?: string | null;
    lock?: LockedAdminPricingSnapshot | null;
  }
): SingleDayDisplayQuote {
  if (
    shouldPreferLockedSingleDayQuote({
      bookingStatus: opts?.bookingStatus,
      confirmedBookingRef: opts?.confirmedBookingRef,
      lock: opts?.lock,
    })
  ) {
    const fromOps = buildLockedSingleDayQuote(opts?.lock || {});
    if (fromOps) {
      return {
        quote: fromOps,
        locked: hasLockedAdminPricing(opts?.lock),
      };
    }
  }
  return { quote: calculateSingleDayQuote(dynamicInput), locked: false };
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Party total → per-person (guests = adults + children, min 1). */
export function singleDayPerPersonEur(
  totalEur: number,
  guests: number
): number {
  const pax = Math.max(1, guests);
  return Math.round(Math.max(0, totalEur) / pax);
}

/** Per-person hourly for a timed private day (e.g. 6h tour). */
export function singleDayPerPersonHourEur(
  totalEur: number,
  guests: number,
  tourHours: number
): number {
  const hours = Math.max(1, tourHours);
  return Math.round(singleDayPerPersonEur(totalEur, guests) / hours);
}

export function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function guidePreferenceLabel(id: GuidePreference): string {
  switch (id) {
    case "local_host":
      return "Local Host";
    case "self_paced":
      return "Self-Paced";
    case "private_guide":
    default:
      return "Private Guide";
  }
}

export function singleDayPaceLabel(
  pace: "fast" | "moderate" | "relaxed" | null
): string | null {
  if (!pace) return null;
  if (pace === "fast") return "Fast Pace";
  if (pace === "moderate") return "Moderate Pace";
  return "Relaxed Pace";
}
