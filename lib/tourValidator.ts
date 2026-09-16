/** Tour capacity rules for Step 5 Experiences. */

import type { SelectedTour } from "@/lib/selectedTours";

/** Strict maximum activity hours on a single calendar day. */
export const MAX_TOUR_HOURS_PER_DAY = 9;

/** @deprecated Use MAX_TOUR_HOURS_PER_DAY — kept for legacy copy references */
export const TOUR_HOURS_PER_NIGHT = MAX_TOUR_HOURS_PER_DAY;

export interface TourHoursLike {
  id: string;
  duration_hours?: number;
}

export function tourDurationHours(tour: TourHoursLike | undefined): number {
  if (!tour) return 0;
  const n = Number(tour.duration_hours);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Resolved hours for a scheduled row (supports tailor-made overrides). */
export function selectedTourRowHours(row: SelectedTour | undefined): number {
  if (!row) return 0;
  return tourDurationHours({ id: row.tourId, duration_hours: row.duration_hours });
}

/** Sum hours from date-bound SelectedTour rows (all days in a city). */
export function selectedTourRowsHours(
  rows: { duration_hours?: number; tourId?: string }[] | undefined | null
): number {
  if (!rows?.length) return 0;
  return rows.reduce(
    (sum, t) => sum + tourDurationHours({ id: t.tourId ?? "", ...t }),
    0
  );
}

/** Hours already booked on a specific day (optionally ignore one tour id). */
export function bookedHoursOnDate(
  rows: SelectedTour[] | undefined | null,
  dateString: string,
  excludeTourId?: string
): number {
  if (!rows?.length || !dateString) return 0;
  return rows
    .filter(
      (t) => t.scheduledDate === dateString && t.tourId !== excludeTourId
    )
    .reduce((sum, t) => sum + selectedTourRowHours(t), 0);
}

/**
 * Remaining bookable hours on a day after existing selections.
 * `9 - sum(duration_hours)` for tours on that date.
 */
export function getAvailableHours(
  rows: SelectedTour[] | undefined | null,
  dateString: string,
  excludeTourId?: string
): number {
  const booked = bookedHoursOnDate(rows, dateString, excludeTourId);
  return Math.max(0, MAX_TOUR_HOURS_PER_DAY - booked);
}

export interface TourCapacityCheck {
  ok: boolean;
  capacityHours: number;
  usedHours: number;
  remainingHours: number;
  message?: string;
}

export const TOUR_DAY_PACKED_MESSAGE =
  "This day is too packed! Maximum 9 hours of activities allowed per day.";

/** Whether a tour fits on a specific scheduled day. */
export function canAddTourOnDate(opts: {
  selectedRows: SelectedTour[] | undefined | null;
  scheduledDate: string;
  newTourDurationHours: number;
  /** When rescheduling, ignore this tour in day totals */
  tourId?: string;
}): TourCapacityCheck {
  const capacityHours = MAX_TOUR_HOURS_PER_DAY;
  const usedHours = bookedHoursOnDate(
    opts.selectedRows,
    opts.scheduledDate,
    opts.tourId
  );
  const remainingHours = getAvailableHours(
    opts.selectedRows,
    opts.scheduledDate,
    opts.tourId
  );
  const adding = Math.max(0, Number(opts.newTourDurationHours) || 0);

  if (adding > remainingHours) {
    return {
      ok: false,
      capacityHours,
      usedHours,
      remainingHours,
      message: TOUR_DAY_PACKED_MESSAGE,
    };
  }

  return {
    ok: true,
    capacityHours,
    usedHours: usedHours + adding,
    remainingHours: Math.max(0, remainingHours - adding),
  };
}

export function selectedTourHours(
  tourIds: string[],
  tours: TourHoursLike[]
): number {
  const byId = Object.fromEntries(tours.map((t) => [t.id, t]));
  return tourIds.reduce((sum, id) => sum + tourDurationHours(byId[id]), 0);
}

/** @deprecated City-wide pool — prefer per-day `canAddTourOnDate` */
export function cityTourCapacityHours(nights: number): number {
  return Math.max(0, Math.round(nights) || 0) * MAX_TOUR_HOURS_PER_DAY;
}

/**
 * @deprecated Use `canAddTourOnDate` with a scheduled date.
 * Kept for callers that only have city-level context; uses first-day check when date provided.
 */
export function canAddTourToCity(opts: {
  cityName: string;
  nights: number;
  selectedTourIds: string[];
  tourId: string;
  tours: TourHoursLike[];
  selectedRows?: SelectedTour[];
  scheduledDate?: string;
}): TourCapacityCheck {
  const tour = opts.tours.find((t) => t.id === opts.tourId);
  const duration = tourDurationHours(tour);

  if (opts.scheduledDate) {
    return canAddTourOnDate({
      selectedRows: opts.selectedRows,
      scheduledDate: opts.scheduledDate,
      newTourDurationHours: duration,
      tourId: opts.tourId,
    });
  }

  const rows = opts.selectedRows ?? [];
  const already = rows.some((r) => r.tourId === opts.tourId);
  if (already) {
    return {
      ok: true,
      capacityHours: MAX_TOUR_HOURS_PER_DAY,
      usedHours: selectedTourRowsHours(rows),
      remainingHours: MAX_TOUR_HOURS_PER_DAY,
    };
  }

  return {
    ok: duration <= MAX_TOUR_HOURS_PER_DAY,
    capacityHours: MAX_TOUR_HOURS_PER_DAY,
    usedHours: 0,
    remainingHours: MAX_TOUR_HOURS_PER_DAY,
    message: duration > MAX_TOUR_HOURS_PER_DAY
      ? TOUR_DAY_PACKED_MESSAGE
      : undefined,
  };
}
