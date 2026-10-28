/**
 * Catalog image order — the SAME ID rule as branding slots, for the
 * Source of Truth catalog (cities, tours/activities/clusters,
 * experiences_and_places, vehicles, transport, hubs, seasonal highlights,
 * feature explainers).
 *
 * Every record's photos live OUTSIDE PocketBase under
 * `public/uploads/catalog/`, named by the record's own PocketBase ID:
 *
 *   /uploads/catalog/{recordId}_1.webp          first photo (web, ≤1600w q80)
 *   /uploads/catalog/{recordId}_1--mobile.webp  first photo (mobile, ≤768w q75)
 *   /uploads/catalog/{recordId}_2.webp          second photo, etc.
 *
 * Replacing a photo overwrites the same files — the ID/URL never changes.
 * PocketBase keeps NO image binary for these slots and no URL needs to be
 * stored on the record: consumers resolve the photo from the record ID.
 * When no slot file exists, consumers fall back to whatever they used
 * before (cover_photo / cover_url / media_file via PocketBase files, etc).
 *
 * Videos follow the same stem — `{recordId}_1.mp4` / `.webm` — stored via
 * the generic catalog upload path (videos get no WebP derivatives).
 */

export const CATALOG_UPLOADS_BASE = "/uploads/catalog";

/** Collections whose records are guest-visible / obviously need a photo. */
export const CATALOG_PHOTO_COLLECTIONS = new Set([
  "cities",
  "tours", // tours + activities + clusters (category field)
  "experiences_and_places",
  "vehicles",
  "transport_products",
  "hubs",
  "seasonal_highlights",
  "feature_explainers",
]);

export function catalogPhotoCollection(collection: string): boolean {
  return CATALOG_PHOTO_COLLECTIONS.has(collection);
}

/** Stable slot key (stableKey for folder "catalog"): `{recordId}_{index}`. */
export function catalogMediaSlot(recordId: string, index = 1): string {
  // Server (writeVpsMediaFile) lowercases stableKeys — match it here so the
  // resolved URL is byte-identical to the file on disk. PB ids are already
  // lowercase alphanumerics, so this is normally a no-op.
  const id = String(recordId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const n = Math.max(1, Math.floor(Number(index) || 1));
  return id ? `${id}_${n}` : "";
}

export function catalogMediaWebUrl(recordId: string, index = 1): string {
  const slot = catalogMediaSlot(recordId, index);
  return slot ? `${CATALOG_UPLOADS_BASE}/${slot}.webp` : "";
}

export function catalogMediaMobileUrl(recordId: string, index = 1): string {
  const slot = catalogMediaSlot(recordId, index);
  return slot ? `${CATALOG_UPLOADS_BASE}/${slot}--mobile.webp` : "";
}

export function catalogMediaSrcSet(recordId: string, index = 1): string {
  const slot = catalogMediaSlot(recordId, index);
  if (!slot) return "";
  return `${catalogMediaMobileUrl(recordId, index)} 768w, ${catalogMediaWebUrl(recordId, index)} 1600w`;
}

/** Additional photo URLs `{recordId}_2 … {recordId}_{count}` (web masters). */
export function catalogMediaGalleryUrls(recordId: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 2; i <= Math.max(1, count); i++) out.push(catalogMediaWebUrl(recordId, i));
  return out.filter(Boolean);
}

/**
 * Optional CSV pass-through: pull an image URL found on a CSV row into the
 * record's `{recordId}_1` slot via the authenticated server route.
 * The shipped CSV templates/exports carry NO image column (verified in
 * lib/catalogCsvHub.ts + ToursCsvSync) — this only fires when a row
 * happens to carry one of these URL columns; otherwise it is a no-op.
 */
export const CATALOG_CSV_IMAGE_KEYS = [
  "image_url",
  "cover_url",
  "photo_url",
  "image",
  "photo",
  "cover_photo_url",
] as const;

export function catalogCsvImageRef(row: Record<string, string>): string {
  for (const k of CATALOG_CSV_IMAGE_KEYS) {
    const v = String(row[k] || "").trim();
    if (/^https?:\/\//i.test(v)) return v;
  }
  return "";
}

export async function pullCatalogImageFromUrl(
  recordId: string,
  imageUrl: string,
  token: string
): Promise<boolean> {
  if (!recordId || !/^https?:\/\//i.test(imageUrl)) return false;
  const res = await fetch("/api/catalog-media/from-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ recordId, imageUrl }),
  });
  return res.ok;
}

/**
 * Best-effort: ask the server to create the auto-placeholder
 * (`{recordId}_1.webp` + mobile pair) for a newly created catalog record
 * that has no photo yet. The server never overwrites an existing slot.
 * Never throws — callers use this fire-and-forget after a successful
 * create, so a placeholder failure must not fail the record save.
 */
export async function ensureCatalogPlaceholder(
  recordId: string,
  title: string,
  token: string
): Promise<boolean> {
  try {
    if (!recordId) return false;
    const res = await fetch("/api/catalog-media/placeholder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ recordId, title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
