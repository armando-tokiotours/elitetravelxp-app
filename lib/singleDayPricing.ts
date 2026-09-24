/**
 * Isolated Single-Day (Builder S) package pricing — never uses multi-day quote math.
 */

import { ELITE_CONCIERGE_FEE } from "@/lib/eliteConcierge";
import type { GuidePreference } from "@/store/useSingleDayBuilderStore";

/** Approx. display FX for Yen companion line (EUR → JPY). */
export const SINGLE_DAY_EUR_TO_JPY = 160;

const GUIDE_HOURLY_EUR: Record<GuidePreference, number> = {
  private_guide: 85,
  local_host: 55,
  self_paced: 0,
};

const PRIVATE_TRANSIT_FLAT_EUR: Record<GuidePreference, number> = {
  private_guide: 160,
  local_host: 120,
  self_paced: 90,
};

export type SingleDayInvoiceLine = {
  id: string;
  label: string;
  amountEur: number;
};

export type SingleDayQuote = {
  lines: SingleDayInvoiceLine[];
  experiencesSubtotal: number;
  transitGuideSubtotal: number;
  conciergeFee: number;
  totalEur: number;
  totalYen: number;
  min: number;
  max: number;
};

export function calculateSingleDayQuote(input: {
  guidePreference: GuidePreference;
  tourHours: number;
  experiencePrices: number[];
  conciergeActive?: boolean;
}): SingleDayQuote {
  const hours = Math.max(1, Number(input.tourHours) || 1);
  const guide = input.guidePreference || "private_guide";
  const transitFlat = PRIVATE_TRANSIT_FLAT_EUR[guide] ?? 160;
  const guideRate = (GUIDE_HOURLY_EUR[guide] ?? 85) * hours;

  const lines: SingleDayInvoiceLine[] = [
    {
      id: "transit_guide",
      label:
        guide === "self_paced"
          ? "Base Single-Day Private Transit + Route Brief"
          : `Base Single-Day Private Transit + Guide (${hours}h)`,
      amountEur: transitFlat + guideRate,
    },
  ];

  const experiencePrices = (input.experiencePrices || []).filter(
    (n) => Number.isFinite(n) && n > 0
  );
  const experiencesSubtotal = experiencePrices.reduce((s, n) => s + n, 0);
  if (experiencesSubtotal > 0) {
    lines.push({
      id: "experiences",
      label: "Selected Experiences & Ticket Fees",
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

  const totalEur = lines.reduce((s, l) => s + l.amountEur, 0);
  const totalYen = Math.round(totalEur * SINGLE_DAY_EUR_TO_JPY);

  return {
    lines,
    experiencesSubtotal,
    transitGuideSubtotal: transitFlat + guideRate,
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
