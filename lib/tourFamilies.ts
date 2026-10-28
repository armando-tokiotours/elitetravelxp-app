/**
 * Tour families — master = the product, variants = the clock.
 *
 * One product in one city (e.g. "City Tour" in Tokyo) is a FAMILY.
 * The master row owns the clean title (no hours), story, route and
 * photo (`{masterId}_1` catalog slot). Each duration (4h / 6h / 8h)
 * is a slim variant row that keeps its own record ID (bookings and
 * per-duration prices reference it) and links via `family_id`.
 *
 * Explicit links win: a row with `family_id` belongs to that master
 * (the master points to itself, `is_family_master`). Legacy rows
 * without `family_id` are auto-grouped by (city + title-without-hours
 * + category) so the existing catalog groups correctly with zero
 * data edits — saving a row in the wizard makes the link explicit.
 */

export type TourFamilyMember = {
  id: string;
  title?: string;
  city_id?: string;
  category?: string;
  duration_hours?: number;
  family_id?: string;
  is_family_master?: boolean;
};

export type TourFamily<T extends TourFamilyMember> = {
  key: string;
  /** Clean product title, hours stripped ("City Tour"). */
  title: string;
  master: T;
  /** All rows in the family, sorted by duration (master included). */
  variants: T[];
};

/** "City Tour, 6h" → "City Tour" · "Food Workshop, 3h (with Mari)" → "Food Workshop (with Mari)" */
export function stripDurationFromTitle(title: string): string {
  const cleaned = String(title || "")
    .replace(/\s*,?\s*\d+(?:\.\d+)?\s*h(?:ours?)?\b/gi, " ")
    .replace(/\s*,\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || String(title || "").trim();
}

export function tourFamilyKey(t: TourFamilyMember): string {
  const fam = String(t.family_id || "").trim();
  if (fam) return `id:${fam}`;
  const title = stripDurationFromTitle(String(t.title || "")).toLowerCase();
  return `auto:${String(t.city_id || "")}|${String(t.category || "tour").toLowerCase()}|${title}`;
}

function sortVariants<T extends TourFamilyMember>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = Number(a.duration_hours) || 999;
    const db = Number(b.duration_hours) || 999;
    if (da !== db) return da - db;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

export function pickFamilyMaster<T extends TourFamilyMember>(rows: T[]): T {
  const sorted = sortVariants(rows);
  return (
    sorted.find((r) => r.is_family_master) ||
    sorted.find((r) => {
      const fam = String(r.family_id || "").trim();
      return fam && fam === r.id;
    }) ||
    sorted[0]
  );
}

export function groupToursByFamily<T extends TourFamilyMember>(
  tours: readonly T[]
): TourFamily<T>[] {
  const byKey = new Map<string, T[]>();
  for (const t of tours) {
    const key = tourFamilyKey(t);
    const list = byKey.get(key);
    if (list) list.push(t);
    else byKey.set(key, [t]);
  }
  const families: TourFamily<T>[] = [];
  for (const [key, rows] of byKey) {
    const master = pickFamilyMaster(rows);
    families.push({
      key,
      title: stripDurationFromTitle(String(master.title || "")) || master.id,
      master,
      variants: sortVariants(rows),
    });
  }
  return families.sort((a, b) => a.title.localeCompare(b.title));
}

/** The master record for any tour row, given the full tour list. */
export function tourFamilyMaster<T extends TourFamilyMember>(
  tour: T,
  all: readonly T[]
): T {
  const fam = String(tour.family_id || "").trim();
  if (fam) {
    const explicit = all.find((t) => t.id === fam);
    if (explicit) return explicit;
    if (fam === tour.id) return tour;
  }
  const key = tourFamilyKey(tour);
  const siblings = all.filter((t) => tourFamilyKey(t) === key);
  return pickFamilyMaster(siblings.length ? siblings : [tour]);
}

/** Master ID whose `{masterId}_1` photo a variant inherits. */
export function tourPhotoOwnerId<T extends TourFamilyMember>(
  tour: T,
  all: readonly T[]
): string {
  return tourFamilyMaster(tour, all).id;
}
