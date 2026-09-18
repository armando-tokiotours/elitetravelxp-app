/** Shared image/upload helpers safe for client bundles (no sharp). */

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
]);

export function isOptimizableImage(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || "").toLowerCase();
  if (IMAGE_MIME.has(type)) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(jpe?g|png|webp|gif|avif|tiff?)$/i.test(name);
}

/** PocketBase `?thumb=` sizes used across the app. */
export const PB_THUMBS = {
  pill: "120x120",
  chip: "100x100",
  card: "600x400",
  banner: "800x400",
  hero: "1920x1080",
} as const;
