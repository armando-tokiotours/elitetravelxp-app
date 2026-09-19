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

/** PocketBase `?thumb=` sizes used across the app (must match migration 1740000036). */
export const PB_THUMBS = {
  /** City navigation pills */
  pill: "100x100",
  chip: "120x120",
  /** Tour / experience cards */
  card: "600x400",
  cardSquare: "400x400",
  banner: "800x400",
  reel: "800x1200",
  hero: "1920x1080",
} as const;
