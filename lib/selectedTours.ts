/** Date-bound tour selections for Step 5. */

export interface SelectedTour {
  tourId: string;
  title: string;
  duration_hours: number;
  /** YYYY-MM-DD the guest scheduled this experience */
  scheduledDate: string;
  price: number;
}

export type SelectedToursByCity = Record<string, SelectedTour[]>;

export function selectedTourIdsFromMap(
  map: SelectedToursByCity | undefined | null
): string[] {
  if (!map) return [];
  return Array.from(
    new Set(
      Object.values(map)
        .flat()
        .map((t) => t.tourId)
    )
  );
}

export function selectedTourIdsByCity(
  map: SelectedToursByCity | undefined | null
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!map) return out;
  for (const [cityId, rows] of Object.entries(map)) {
    const ids = Array.from(new Set(rows.map((r) => r.tourId)));
    if (ids.length) out[cityId] = ids;
  }
  return out;
}

export function totalSelectedTourHours(
  rows: SelectedTour[] | undefined | null
): number {
  if (!rows?.length) return 0;
  return rows.reduce((sum, t) => {
    const h = Number(t.duration_hours);
    return sum + (Number.isFinite(h) && h > 0 ? h : 0);
  }, 0);
}

export function toursOnDate(
  rows: SelectedTour[] | undefined | null,
  date: string
): SelectedTour[] {
  if (!rows?.length || !date) return [];
  return rows.filter((t) => t.scheduledDate === date);
}

/** Migrate legacy cityId → tourId[] into date-bound rows (date optional/empty). */
export function migrateLegacySelectedTours(
  byCity: Record<string, string[]> | undefined | null,
  flatIds: string[] | undefined | null,
  lookup?: (tourId: string) => Partial<SelectedTour> | null
): SelectedToursByCity {
  const out: SelectedToursByCity = {};
  const source =
    byCity && Object.keys(byCity).length > 0
      ? byCity
      : flatIds?.length
        ? { _global: flatIds }
        : {};

  for (const [cityId, ids] of Object.entries(source)) {
    if (cityId === "_global") continue;
    const rows: SelectedTour[] = [];
    for (const tourId of ids) {
      const meta = lookup?.(tourId);
      rows.push({
        tourId,
        title: meta?.title ?? tourId,
        duration_hours: Number(meta?.duration_hours) || 0,
        scheduledDate: meta?.scheduledDate ?? "",
        price: Number(meta?.price) || 0,
      });
    }
    if (rows.length) out[cityId] = rows;
  }
  return out;
}

export function syncTourDerived(selectedTours: SelectedToursByCity) {
  return {
    selectedTours,
    selectedToursByCity: selectedTourIdsByCity(selectedTours),
    selectedTourIds: selectedTourIdsFromMap(selectedTours),
  };
}
