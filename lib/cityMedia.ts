import type { PbCity } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaThumbs";

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
  thumbOrOpts?: string | { thumb?: string; format?: "webp" | "png" | "jpeg" }
): string {
  if (!city) return "";
  const file = cityPhoto(city);
  if (!file) return "";
  const collection = city.collectionId || "cities";
  const opts =
    typeof thumbOrOpts === "string"
      ? { thumb: thumbOrOpts, format: "webp" as const }
      : { format: "webp" as const, ...thumbOrOpts };
  return pbFileUrl(collection, city.id, file, opts);
}

/**
 * Ordered image candidates: PB thumb → static optimized webp → placeholder.
 * Prefers `-thumb.webp` / `-card.webp` variants from the batch optimizer.
 */
export function cityImageCandidates(
  city: PbCity | null | undefined,
  opts?: { name?: string; thumb?: string; variant?: "thumb" | "card" | "hero" }
): string[] {
  const name = opts?.name || city?.name || "";
  const slug = citySlugFromName(name);
  const variant = opts?.variant ?? "thumb";
  const thumb = opts?.thumb ?? PB_THUMBS.pill;
  const list: string[] = [];
  const pb = cityPbImageUrl(city, thumb);
  if (pb) list.push(pb);
  if (slug) {
    list.push(`/images/cities/${slug}-${variant}.webp`);
    list.push(`/images/cities/${slug}.webp`);
  }
  list.push(`/images/placeholder-city-${variant}.webp`);
  list.push(CITY_PLACEHOLDER);
  return Array.from(new Set(list));
}
