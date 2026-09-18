import type { PbCity } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";

/** Ultimate fallback when PocketBase + static city assets fail. */
export const CITY_PLACEHOLDER = "/images/placeholder-city.webp";

/** Map display names → static asset slug under /images/cities/{slug}.webp */
export function citySlugFromName(name: string | undefined | null): string {
  return (name || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** PocketBase file URL for a city cover (empty if no photo). */
export function cityPbImageUrl(
  city: PbCity | null | undefined,
  thumb?: string
): string {
  if (!city) return "";
  const file = cityPhoto(city);
  if (!file) return "";
  const collection = city.collectionId || "cities";
  return pbFileUrl(collection, city.id, file, thumb);
}

/**
 * Ordered image candidates: PB → static /images/cities/{slug}.webp → placeholder.
 */
export function cityImageCandidates(
  city: PbCity | null | undefined,
  opts?: { name?: string; thumb?: string }
): string[] {
  const name = opts?.name || city?.name || "";
  const slug = citySlugFromName(name);
  const list: string[] = [];
  const pb = cityPbImageUrl(city, opts?.thumb);
  if (pb) list.push(pb);
  if (slug) list.push(`/images/cities/${slug}.webp`);
  list.push(CITY_PLACEHOLDER);
  return Array.from(new Set(list));
}
