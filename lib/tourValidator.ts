/** Tour capacity rules for Step 5 Experiences. */

export const TOUR_HOURS_PER_NIGHT = 10;

export interface TourHoursLike {
  id: string;
  duration_hours?: number;
}

export function cityTourCapacityHours(nights: number): number {
  return Math.max(0, Math.round(nights) || 0) * TOUR_HOURS_PER_NIGHT;
}

export function tourDurationHours(tour: TourHoursLike | undefined): number {
  if (!tour) return 0;
  const n = Number(tour.duration_hours);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function selectedTourHours(
  tourIds: string[],
  tours: TourHoursLike[]
): number {
  const byId = Object.fromEntries(tours.map((t) => [t.id, t]));
  return tourIds.reduce((sum, id) => sum + tourDurationHours(byId[id]), 0);
}

/** Sum hours from date-bound SelectedTour rows (preferred). */
export function selectedTourRowsHours(
  rows: { duration_hours?: number }[] | undefined | null
): number {
  if (!rows?.length) return 0;
  return rows.reduce((sum, t) => sum + tourDurationHours({ id: "", ...t }), 0);
}

export interface TourCapacityCheck {
  ok: boolean;
  capacityHours: number;
  usedHours: number;
  remainingHours: number;
  message?: string;
}

/**
 * Whether adding `tourId` fits within nights × 10h for the city stay.
 * Removing an already-selected tour is always allowed.
 */
export function canAddTourToCity(opts: {
  cityName: string;
  nights: number;
  selectedTourIds: string[];
  tourId: string;
  tours: TourHoursLike[];
  /** When provided, used for hour totals instead of selectedTourIds lookup */
  selectedRows?: { duration_hours?: number; tourId?: string }[];
}): TourCapacityCheck {
  const capacityHours = cityTourCapacityHours(opts.nights);
  const already = opts.selectedRows
    ? opts.selectedRows.some((r) => r.tourId === opts.tourId)
    : opts.selectedTourIds.includes(opts.tourId);

  const usedHours = opts.selectedRows
    ? selectedTourRowsHours(opts.selectedRows)
    : selectedTourHours(opts.selectedTourIds, opts.tours);

  if (already) {
    return {
      ok: true,
      capacityHours,
      usedHours,
      remainingHours: Math.max(0, capacityHours - usedHours),
    };
  }

  const adding = tourDurationHours(
    opts.tours.find((t) => t.id === opts.tourId)
  );
  const nextUsed = usedHours + adding;
  const remainingHours = Math.max(0, capacityHours - usedHours);

  if (nextUsed > capacityHours) {
    return {
      ok: false,
      capacityHours,
      usedHours,
      remainingHours,
      message: `You have reached the maximum recommended activities for your stay in ${opts.cityName}. Please add more nights or remove a tour.`,
    };
  }

  return {
    ok: true,
    capacityHours,
    usedHours: nextUsed,
    remainingHours: Math.max(0, capacityHours - nextUsed),
  };
}
