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
