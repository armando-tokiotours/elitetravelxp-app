import type { PbTour } from "@/lib/pocketbase/client";
import { calculateTourPrice } from "@/lib/tourPricing";

export type BudgetInputMode = "per_person_day" | "total";
export type StayStrategy = "self" | "budget_hotels";

export type BudgetDisplayBadge =
  | "FREE / LOW-COST"
  | "POPULAR"
  | "SELF-GUIDED"
  | string;

export interface BudgetPlannerInput {
  mode: BudgetInputMode;
  /** EUR amount — per person/day OR total trip depending on mode */
  targetAmount: number;
  adults: number;
  children: number;
  days: number;
  stayStrategy: StayStrategy;
}

export interface BudgetTourSuggestion {
  tour: PbTour;
  partyPrice: number;
  perPerson: number;
  fitsBudget: boolean;
  tag: "free_or_low" | "value" | "stretch";
  badgeLabel: string | null;
  isSelfGuided: boolean;
}

export interface BudgetPlanResult {
  guests: number;
  totalBudget: number;
  fixedTransitEstimate: number;
  stayReserve: number;
  usableForExperiences: number;
  dailyPerPerson: number;
  suggestions: BudgetTourSuggestion[];
  leftoverAfterAllSuggestions: number;
}

/** PocketBase filter for curated free / low-cost / self-guided highlights. */
export const BUDGET_PLANNER_PB_FILTER =
  "(pricing_tier = 'free' || pricing_tier = 'low_cost' || is_self_guided = true)";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

/** Auto-badge: free/low tier, self-guided, or base ticket ≤ €50. */
export function isFreeOrLowCostTour(tour: PbTour): boolean {
  const tier = String(tour.pricing_tier || "").toLowerCase();
  if (tier === "free" || tier === "low_cost") return true;
  if (tour.is_self_guided === true) return true;
  if (tour.display_badge === "FREE / LOW-COST") return true;
  const base = n(tour.base_price_eur);
  if (base > 0 && base <= 50) return true;
  if (base === 0 && tier === "free") return true;
  // Zero party tier often means free landmark / ticket-only unset
  if (n(tour.price_1_pax) === 0 && n(tour.price_2_pax) === 0) return true;
  return false;
}

export function resolveDisplayBadge(tour: PbTour): string | null {
  if (tour.display_badge) return String(tour.display_badge);
  if (tour.is_self_guided === true && !isFreeOrLowCostTour(tour)) {
    return "SELF-GUIDED";
  }
  if (isFreeOrLowCostTour(tour)) return "FREE / LOW-COST";
  return null;
}

/**
 * Party total for budget planner.
 * Self-guided / ticket-only: base_price_eur × guests (no guide surcharge).
 * Otherwise: tiered tour pricing.
 */
export function calculateBudgetPartyPrice(
  tour: PbTour,
  adults: number,
  children: number
): number {
  const guests = Math.max(0, Math.floor(adults) + Math.floor(children));
  if (guests === 0) return 0;

  const selfGuided =
    tour.is_self_guided === true || tour.guide_required === false;
  const baseEur = n(tour.base_price_eur);

  if (selfGuided && (baseEur > 0 || tour.is_self_guided === true)) {
    // Ticket-only: prefer explicit base_price_eur; else fall back to tier math
    if (baseEur > 0 || tour.pricing_tier === "free") {
      return Math.round(baseEur * guests);
    }
  }

  return calculateTourPrice({ adults, children }, tour);
}

/** Rough fixed transit allowance (airports + intercity) so experiences stay within budget. */
export function estimateFixedTransitEur(days: number, guests: number): number {
  const g = Math.max(1, guests);
  const d = Math.max(1, days);
  const airport = 45 * g * 2;
  const intercityLegs = Math.max(0, Math.ceil(d / 4) - 1);
  const rail = intercityLegs * 55 * g;
  return Math.round(airport + rail);
}

/** Soft reserve when user wants budget hotels suggested (not forced). */
export function estimateStayReserveEur(
  days: number,
  guests: number,
  strategy: StayStrategy
): number {
  if (strategy === "self") return 0;
  const rooms = Math.max(1, Math.ceil(guests / 2));
  const nights = Math.max(1, days - 1);
  return Math.round(rooms * nights * 55);
}

export function resolveTotalBudget(input: BudgetPlannerInput): number {
  const guests = Math.max(1, input.adults + input.children);
  const days = Math.max(1, input.days);
  const amount = Math.max(0, Number(input.targetAmount) || 0);
  if (input.mode === "total") return Math.round(amount);
  return Math.round(amount * guests * days);
}

/**
 * Rank tours: free/low/self-guided first, then ascending party price.
 * Tags FREE / LOW-COST via schema flags + auto rules (base ≤ €50 / self-guided).
 */
export function buildBudgetPlan(
  input: BudgetPlannerInput,
  tours: PbTour[]
): BudgetPlanResult {
  const guests = Math.max(1, input.adults + input.children);
  const days = Math.max(1, input.days);
  const totalBudget = resolveTotalBudget(input);
  const fixedTransitEstimate = estimateFixedTransitEur(days, guests);
  const stayReserve = estimateStayReserveEur(days, guests, input.stayStrategy);
  const usableForExperiences = Math.max(
    0,
    totalBudget - fixedTransitEstimate - stayReserve
  );
  const dailyPerPerson =
    guests > 0 && days > 0 ? Math.round(totalBudget / (guests * days)) : 0;

  const active = tours.filter((t) => t.is_active !== false);
  const priced = active
    .map((tour) => {
      const partyPrice = calculateBudgetPartyPrice(
        tour,
        input.adults,
        input.children
      );
      const perPerson = guests > 0 ? Math.round(partyPrice / guests) : partyPrice;
      const freeOrLow = isFreeOrLowCostTour(tour) || partyPrice === 0;
      return {
        tour,
        partyPrice,
        perPerson,
        freeOrLow,
        isSelfGuided:
          tour.is_self_guided === true || tour.guide_required === false,
        badgeLabel: resolveDisplayBadge(tour),
      };
    })
    .filter((row) => Number.isFinite(row.partyPrice))
    .sort((a, b) => {
      if (a.freeOrLow !== b.freeOrLow) return a.freeOrLow ? -1 : 1;
      return (
        a.partyPrice - b.partyPrice ||
        a.tour.title.localeCompare(b.tour.title)
      );
    });

  let running = 0;
  const suggestions: BudgetTourSuggestion[] = priced.map((row) => {
    const fitsBudget =
      row.partyPrice === 0 || running + row.partyPrice <= usableForExperiences;
    if (fitsBudget && row.partyPrice > 0) running += row.partyPrice;
    let tag: BudgetTourSuggestion["tag"] = "stretch";
    if (row.freeOrLow) {
      tag = "free_or_low";
    } else if (fitsBudget) {
      tag = "value";
    }
    return {
      tour: row.tour,
      partyPrice: row.partyPrice,
      perPerson: row.perPerson,
      fitsBudget,
      tag,
      badgeLabel: row.badgeLabel,
      isSelfGuided: row.isSelfGuided,
    };
  });

  return {
    guests,
    totalBudget,
    fixedTransitEstimate,
    stayReserve,
    usableForExperiences,
    dailyPerPerson,
    suggestions: suggestions.slice(0, 24),
    leftoverAfterAllSuggestions: Math.max(
      0,
      usableForExperiences -
        suggestions
          .filter((s) => s.fitsBudget)
          .reduce((sum, s) => sum + s.partyPrice, 0)
    ),
  };
}
