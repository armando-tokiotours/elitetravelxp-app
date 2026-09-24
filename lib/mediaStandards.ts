/**
 * VPS / content media standards for TOKIOTOURS.
 *
 * Prefer PocketBase `?thumb=` sizes from PB_THUMBS (lib/imageProcessor.ts).
 * Admin uploads are auto-compressed to WebP ≤1920×1080 via /api/admin/optimize-upload.
 *
 * Image targets:
 * - Thumbnail / city pills: 120×120 WebP
 * - Cards: 600×400 WebP
 * - Hero banners: 1920×1080 max, WebP, under 250KB
 *
 * Background / tour videos:
 * - Max resolution 1080p · ~1.5 Mbps · mp4/webm · under 5MB
 * - Use preload="metadata" for grid tiles; preload="auto" only for critical hero reels
 *
 * Example ffmpeg:
 *   ffmpeg -i input.mov -vf "scale=-2:1080" -c:v libx264 -b:v 1500k \
 *     -c:a aac -b:a 96k -movflags +faststart output.mp4
 */
export const MEDIA_STANDARDS = {
  thumbnail: { width: 120, height: 120, maxBytes: 25_000 },
  card: { width: 600, height: 400, maxBytes: 80_000 },
  hero: { maxWidth: 1920, maxHeight: 1080, maxBytes: 250_000 },
  video: {
    maxHeight: 1080,
    targetBitrateKbps: 1500,
    maxBytes: 5_000_000,
    formats: ["mp4", "webm"] as const,
  },
  imageSizesDefault: "(max-width: 768px) 100vw, 50vw",
  imageSizesPill: "80px",
  imageSizesCard: "(max-width: 768px) 50vw, 300px",
} as const;

export { PB_THUMBS } from "@/lib/mediaThumbs";
