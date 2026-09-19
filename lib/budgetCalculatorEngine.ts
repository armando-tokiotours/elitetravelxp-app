import type { PbTour } from "@/lib/pocketbase/client";
import { calculateTourPrice } from "@/lib/tourPricing";

export type BudgetInputMode = "per_person_day" | "total";
export type StayStrategy = "self" | "budget_hotels";

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

/** Rough fixed transit allowance (airports + intercity) so experiences stay within budget. */
export function estimateFixedTransitEur(days: number, guests: number): number {
  const g = Math.max(1, guests);
  const d = Math.max(1, days);
  const airport = 45 * g * 2; // pickup + dropoff band
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
  return Math.round(rooms * nights * 55); // capsule / 2–3★ band
}

export function resolveTotalBudget(input: BudgetPlannerInput): number {
  const guests = Math.max(1, input.adults + input.children);
  const days = Math.max(1, input.days);
  const amount = Math.max(0, Number(input.targetAmount) || 0);
  if (input.mode === "total") return Math.round(amount);
  return Math.round(amount * guests * days);
}

/**
 * Rank active tours by ascending party price and tag by fit vs usable experience budget.
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
      const partyPrice = calculateTourPrice(
        { adults: input.adults, children: input.children },
        tour
      );
      const perPerson = guests > 0 ? Math.round(partyPrice / guests) : partyPrice;
      return { tour, partyPrice, perPerson };
    })
    .filter((row) => Number.isFinite(row.partyPrice))
    .sort((a, b) => a.partyPrice - b.partyPrice || a.tour.title.localeCompare(b.tour.title));

  let running = 0;
  const suggestions: BudgetTourSuggestion[] = priced.map((row) => {
    const fitsBudget =
      row.partyPrice === 0 || running + row.partyPrice <= usableForExperiences;
    if (fitsBudget && row.partyPrice > 0) running += row.partyPrice;
    let tag: BudgetTourSuggestion["tag"] = "stretch";
    if (row.partyPrice === 0 || row.partyPrice <= usableForExperiences * 0.12) {
      tag = "free_or_low";
    } else if (fitsBudget) {
      tag = "value";
    }
    return {
      ...row,
      fitsBudget,
      tag,
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
