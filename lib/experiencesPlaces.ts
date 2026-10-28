/**
 * Single-Day Experiences & Places — filter tabs, time budget, entry typing.
 *
 * 3-tier catalog (internal keys → guest UI labels):
 * - Tour (`tour`) → Guided Tours — private guide day routes
 * - Experience / Activity (`activity`) → Experiences & Tickets
 * - Cluster (`cluster`) → Areas & Neighborhoods — free-roam, 8h meter
 */

import type { PbTour } from "@/lib/pocketbase/client";
import { experienceNeedsEntryTicket } from "@/lib/accessType";
import { isBestMatchTour, type ExperienceProfile } from "@/lib/experienceProfiler";

/** Standard wall-clock day for neighborhood areas (≈3 × 2.5h). */
export const CLUSTER_DAY_MAX_HOURS = 8;
export const CLUSTER_SOFT_MAX_COUNT = 3;
export const CLUSTER_DEFAULT_HOURS = 2.5;

/** Primary catalog segment — Tours | Experiences | Areas */
export type ExperiencesPlacesSegment = "tour" | "activity" | "places";

/** Guest-facing kind for badges / empty states (maps from PB category). */
export type CatalogKind = "tour" | "activity" | "cluster";

export type ExperiencesPlacesTab =
  | "all"
  | "culture"
  | "food"
  | "modern"
  | "matches"
  | "places";

/** Primary segment pills (replaces Tour | Activity only). */
export const EXPERIENCES_PLACES_SEGMENTS: {
  id: ExperiencesPlacesSegment;
  label: string;
  shortLabel: string;
}[] = [
  { id: "tour", label: "Guided Tours", shortLabel: "Tours" },
  { id: "activity", label: "Experiences & Tickets", shortLabel: "Experiences" },
  { id: "places", label: "Areas & Neighborhoods", shortLabel: "Areas" },
];

/** Vibe / match filters — shown under Tours & Experiences (not Areas). */
export const EXPERIENCES_PLACES_TABS: {
  id: ExperiencesPlacesTab;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "culture", label: "Culture" },
  { id: "food", label: "Food & Nightlife" },
  { id: "modern", label: "Modern & Art" },
  { id: "matches", label: "Your Matches" },
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

type CatalogKindFields = {
  category?: string | null;
  entry_type?: string | null;
};

/** Regional neighborhood cluster (Asakusa, Shibuya…) — time budget, €0 item price. */
export function isClusterItem(item: CatalogKindFields): boolean {
  const et = String(item.entry_type || "").toLowerCase();
  if (et === "cluster") return true;
  const cat = String(item.category || "").toLowerCase();
  return cat === "cluster";
}

export function isPlaceItem(item: CatalogKindFields): boolean {
  if (isClusterItem(item)) return true;
  const et = String(item.entry_type || "").toLowerCase();
  if (et === "place") return true;
  const cat = String(item.category || "").toLowerCase();
  return cat === "place";
}

export function isActivityItem(item: CatalogItem): boolean {
  if (isPlaceItem(item) || isClusterItem(item)) return false;
  return String(item.category || "").toLowerCase() === "activity";
}

export function isTourItem(item: CatalogItem): boolean {
  return (
    !isPlaceItem(item) &&
    !isClusterItem(item) &&
    String(item.category || "").toLowerCase() !== "activity"
  );
}

/** Resolve PB category / entry_type → guest-facing catalog kind. */
export function catalogKind(item: CatalogKindFields): CatalogKind {
  if (isClusterItem(item) || isPlaceItem(item)) return "cluster";
  if (String(item.category || "").toLowerCase() === "activity") {
    return "activity";
  }
  return "tour";
}

/** Guest-facing labels — keep internal keys (`cluster`, etc.) unchanged. */
export const CATALOG_KIND_LABELS: Record<
  CatalogKind,
  { short: string; full: string; hint: string }
> = {
  tour: {
    short: "Guided Tour",
    full: "Guided Tours",
    hint: "Private guide included · day route",
  },
  activity: {
    short: "Experience & Ticket",
    full: "Experiences & Tickets",
    hint: "Ticketed attraction · outside guide hours",
  },
  cluster: {
    short: "Area / Neighborhood",
    full: "Areas & Neighborhoods",
    hint: "Free-roam sector · uses daily time meter",
  },
};

/** Stop Pass / ticket card badge — tour vs experience vs area. */
export function itineraryStopBadgeLabel(
  item: CatalogKindFields & { is_extra?: boolean | null }
): string {
  const kind = catalogKind(item);
  if (kind === "cluster") return CATALOG_KIND_LABELS.cluster.short;
  // Legacy extras without category still badge as Experience & Ticket
  if (kind === "activity" || item.is_extra === true) {
    return CATALOG_KIND_LABELS.activity.short;
  }
  return CATALOG_KIND_LABELS.tour.short;
}

/**
 * Day Services → Tickets: live extras (experiences / entry tickets), not guided
 * tours or free-roam areas. Prefer `is_extra` so legacy rows without category
 * still appear (e.g. Matcha selected before category was persisted).
 */
export function isDayServicesTicketRow(row: {
  is_extra?: boolean | null;
  access_type?: string | null;
  category?: string | null;
  entry_type?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  const kind = catalogKind(row);
  if (kind === "cluster") return false;
  if (kind === "activity") return true;
  if (row.is_extra === true) return true;
  if (kind === "tour") return false;
  return experienceNeedsEntryTicket({
    title: row.title,
    description: row.description,
    access_type: row.access_type,
    category: row.category,
  });
}

/** Badge chip classes (dark builder modal + light multi-day drawer). */
export const CATALOG_KIND_BADGE: Record<
  CatalogKind,
  { dark: string; light: string }
> = {
  tour: {
    dark: "border-cyan-400/40 bg-cyan-500/30 text-cyan-200",
    light: "border-[#075473]/40 bg-[#075473]/10 text-[#7E3202]",
  },
  activity: {
    dark: "border-[#DC6E8A]/45 bg-[#DC6E8A]/25 text-[#F5C4D0]",
    light: "border-[#DC6E8A]/35 bg-[#DC6E8A]/10 text-[#9B3D56]",
  },
  cluster: {
    dark: "border-[#1BA58A]/45 bg-[#1BA58A]/25 text-[#8EE0CB]",
    light: "border-[#1BA58A]/35 bg-[#1BA58A]/10 text-[#0F6B58]",
  },
};

/** Hours an area/cluster spends on the 8h day meter (default 2.5h). */
export function clusterDurationHours(item: {
  duration_hours?: number;
}): number {
  const n = Number(item.duration_hours);
  return Number.isFinite(n) && n > 0 ? n : CLUSTER_DEFAULT_HOURS;
}

/** Selected day stops that are regional areas / places (for the 8h meter). */
export function selectedClusterRows<T extends { tourId: string; duration_hours?: number; title?: string }>(
  rows: T[],
  catalog: CatalogItem[]
): T[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return rows.filter((r) => {
    const item = byId.get(r.tourId);
    return item ? isPlaceItem(item) || isClusterItem(item) : false;
  });
}

export function filterCatalogBySegment(
  items: CatalogItem[],
  segment: ExperiencesPlacesSegment
): CatalogItem[] {
  if (segment === "places") return items.filter(isPlaceItem);
  if (segment === "activity") return items.filter(isActivityItem);
  return items.filter(isTourItem);
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
  if (isPlaceItem(item) || isClusterItem(item)) return false;
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
