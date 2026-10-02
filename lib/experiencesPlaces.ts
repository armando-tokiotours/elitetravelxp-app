/**
 * Single-Day Experiences & Places — filter tabs, time budget, entry typing.
 */

import type { PbTour } from "@/lib/pocketbase/client";
import { experienceNeedsEntryTicket } from "@/lib/accessType";
import { isBestMatchTour, type ExperienceProfile } from "@/lib/experienceProfiler";

export type ExperiencesPlacesSegment = "tour" | "activity";

export type ExperiencesPlacesTab =
  | "all"
  | "culture"
  | "food"
  | "modern"
  | "matches"
  | "places";

export const EXPERIENCES_PLACES_TABS: {
  id: ExperiencesPlacesTab;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "culture", label: "Culture" },
  { id: "food", label: "Food & Nightlife" },
  { id: "modern", label: "Modern & Art" },
  { id: "matches", label: "Your Matches" },
  { id: "places", label: "Places" },
];

export type GoogleLocation = {
  lat?: number;
  lng?: number;
  place_id?: string;
  address?: string;
};

export type CatalogItem = PbTour & {
  entry_type?: "experience" | "place" | string;
  google_location?: GoogleLocation | null;
  /** Synthetic id prefix when sourced from experiences_and_places */
  _source?: "tours" | "eap";
};

export function isPlaceItem(item: CatalogItem): boolean {
  const et = String(item.entry_type || "").toLowerCase();
  if (et === "place") return true;
  const cat = String(item.category || "").toLowerCase();
  return cat === "place";
}

export function isActivityItem(item: CatalogItem): boolean {
  if (isPlaceItem(item)) return true;
  return String(item.category || "").toLowerCase() === "activity";
}

export function isTourItem(item: CatalogItem): boolean {
  return (
    !isPlaceItem(item) &&
    String(item.category || "").toLowerCase() !== "activity"
  );
}

export function filterCatalogBySegment(
  items: CatalogItem[],
  segment: ExperiencesPlacesSegment
): CatalogItem[] {
  return segment === "activity"
    ? items.filter(isActivityItem)
    : items.filter(isTourItem);
}

export function formatDurationBadge(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (Number.isInteger(hours)) return `${hours}h`;
  const rounded = Math.round(hours * 4) / 4;
  return `${rounded}h`;
}

/**
 * Guide-hour budget only covers guided / tour stops.
 * Ticket extras (TeamLab…), places, and Activity-catalog items sit outside the guide clock.
 */
export function isGuideBudgetCatalogItem(item: CatalogItem): boolean {
  if (experienceNeedsEntryTicket(item)) return false;
  if (isPlaceItem(item)) return false;
  if (String(item.category || "").toLowerCase() === "activity") return false;
  return true;
}

export type GuideBudgetRow = {
  duration_hours?: number;
  title?: string;
  access_type?: string;
  /** Explicit flag set when adding from catalog */
  is_extra?: boolean;
};

/** Whether a selected stop consumes guide hours (tourHours). */
export function countsTowardGuideHours(row: GuideBudgetRow): boolean {
  if (row.is_extra === true) return false;
  if (row.is_extra === false) return true;
  // Legacy rows without flag — infer from ticket signals
  return !experienceNeedsEntryTicket({
    title: row.title,
    access_type: row.access_type,
  });
}

export function selectedHoursTotal(
  rows: { duration_hours?: number }[]
): number {
  return rows.reduce((sum, r) => {
    const n = Number(r.duration_hours);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/** Hours that count against the guide / tourHours budget. */
export function selectedGuideHoursTotal(rows: GuideBudgetRow[]): number {
  return rows.reduce((sum, r) => {
    if (!countsTowardGuideHours(r)) return sum;
    const n = Number(r.duration_hours);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/** Ticket / place extras — wall-clock only, not guide budget. */
export function selectedExtraHoursTotal(rows: GuideBudgetRow[]): number {
  return rows.reduce((sum, r) => {
    if (countsTowardGuideHours(r)) return sum;
    const n = Number(r.duration_hours);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export function filterCatalogByTab(
  items: CatalogItem[],
  tab: ExperiencesPlacesTab,
  profile: ExperienceProfile | null | undefined
): CatalogItem[] {
  switch (tab) {
    case "places":
      return items.filter(isPlaceItem);
    case "culture":
      return items.filter(
        (i) =>
          !isPlaceItem(i) &&
          (i.vibe_tags || []).some((t) =>
            ["culture"].includes(String(t).toLowerCase())
          )
      );
    case "food":
      return items.filter(
        (i) =>
          !isPlaceItem(i) &&
          (i.vibe_tags || []).some((t) =>
            ["foodie", "nightlife", "food"].includes(String(t).toLowerCase())
          )
      );
    case "modern":
      return items.filter(
        (i) =>
          !isPlaceItem(i) &&
          (i.vibe_tags || []).some((t) =>
            ["modern", "art"].includes(String(t).toLowerCase())
          )
      );
    case "matches":
      return items.filter(
        (i) => !isPlaceItem(i) && isBestMatchTour(i, profile)
      );
    case "all":
    default:
      return items;
  }
}

export function filterCatalogByCity(
  items: CatalogItem[],
  cityId: string | null | undefined,
  cityName: string | null | undefined
): CatalogItem[] {
  if (!cityId && !cityName) return items;
  const name = (cityName || "").trim().toLowerCase();
  return items.filter((i) => {
    if (cityId && i.city_id === cityId) return true;
    if (name && i.expand?.city_id?.name?.toLowerCase() === name) return true;
    return false;
  });
}
