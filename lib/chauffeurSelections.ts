/** Day-vs-tour private chauffeur selection helpers. */

export type DriverMode = "none" | "full_day" | "by_tour";

export interface DailyChauffeurSelection {
  mode: DriverMode;
  /** Populated when mode === "by_tour" */
  selectedTourIds: string[];
}

/** cityId → date (YYYY-MM-DD) → selection */
export type ChauffeurSelections = Record<
  string,
  Record<string, DailyChauffeurSelection>
>;

export function emptyChauffeurSelection(
  mode: DriverMode = "none"
): DailyChauffeurSelection {
  return { mode, selectedTourIds: [] };
}

export function isBillableChauffeurDay(
  sel?: DailyChauffeurSelection | null
): boolean {
  if (!sel || sel.mode === "none") return false;
  if (sel.mode === "full_day") return true;
  return (sel.selectedTourIds?.length ?? 0) > 0;
}

/** Dates with an active chauffeur booking per city (legacy-compatible). */
export function chauffeurDaysFromSelections(
  selections: ChauffeurSelections | undefined | null
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!selections) return out;
  for (const [cityId, byDate] of Object.entries(selections)) {
    const dates: string[] = [];
    for (const [date, sel] of Object.entries(byDate ?? {})) {
      if (isBillableChauffeurDay(sel)) dates.push(date);
    }
    if (dates.length) out[cityId] = dates.sort();
  }
  return out;
}

export function countBillableChauffeurDays(
  selections: ChauffeurSelections | undefined | null
): number {
  return Object.values(chauffeurDaysFromSelections(selections)).reduce(
    (n, dates) => n + dates.length,
    0
  );
}

/** Migrate old cityId → date[] map into structured selections (full_day). */
export function migrateLegacyChauffeurDays(
  days: Record<string, string[]> | undefined | null
): ChauffeurSelections {
  const out: ChauffeurSelections = {};
  if (!days) return out;
  for (const [cityId, dates] of Object.entries(days)) {
    if (!dates?.length) continue;
    out[cityId] = {};
    for (const date of dates) {
      out[cityId][date] = { mode: "full_day", selectedTourIds: [] };
    }
  }
  return out;
}

export function upsertChauffeurSelection(
  prev: ChauffeurSelections,
  cityId: string,
  date: string,
  next: DailyChauffeurSelection | null
): ChauffeurSelections {
  const city = { ...(prev[cityId] ?? {}) };
  if (!next || next.mode === "none") {
    delete city[date];
  } else {
    city[date] = {
      mode: next.mode,
      selectedTourIds:
        next.mode === "by_tour"
          ? Array.from(new Set(next.selectedTourIds ?? []))
          : [],
    };
  }
  const out = { ...prev };
  if (Object.keys(city).length === 0) delete out[cityId];
  else out[cityId] = city;
  return out;
}
