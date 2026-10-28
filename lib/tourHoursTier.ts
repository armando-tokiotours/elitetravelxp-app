/** Custom duration bounds for Builder S Hours & Date. */
export const TOUR_HOURS_CUSTOM_MIN = 5;
export const TOUR_HOURS_CUSTOM_MAX = 10;

/**
 * Map selected tour hours → billing tier + ops confirmation flag.
 * - 5h priced as 6h
 * - 7h priced as 8h
 * - 9–10h bill as full-day (10h) and need agent/ops confirmation
 */
export function resolveTourHoursTier(hours: number): {
  hours: number;
  billingHours: 6 | 8 | 10;
  needsAgentConfirmation: boolean;
} {
  const h = Math.max(
    TOUR_HOURS_CUSTOM_MIN,
    Math.min(TOUR_HOURS_CUSTOM_MAX, Math.round(Number(hours) || 6))
  );
  if (h <= 6) {
    return { hours: h, billingHours: 6, needsAgentConfirmation: false };
  }
  if (h <= 8) {
    return { hours: h, billingHours: 8, needsAgentConfirmation: false };
  }
  return { hours: h, billingHours: 10, needsAgentConfirmation: true };
}

/** Clamp a custom hours input to the allowed 5–10 range. */
export function clampCustomTourHours(raw: number): number {
  const n = Math.round(Number(raw) || TOUR_HOURS_CUSTOM_MIN);
  return Math.max(TOUR_HOURS_CUSTOM_MIN, Math.min(TOUR_HOURS_CUSTOM_MAX, n));
}
