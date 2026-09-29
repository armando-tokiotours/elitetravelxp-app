/**
 * VPS / content media standards for TOKIOTOURS.
 *
 * Prefer PocketBase `?thumb=` sizes from PB_THUMBS (lib/imageProcessor.ts).
 * Admin uploads are auto-compressed via /api/admin/optimize-upload:
 * - Images → JPEG ≤1920×1080 (PocketBase thumbs)
 * - Videos → H.264 MP4, longer edge ≤1280, CRF 22, +faststart (fast mobile start)
 *
 * Image targets:
 * - Thumbnail / city pills: 120×120 WebP
 * - Cards: 600×400 WebP
 * - Hero banners: 1920×1080 max, WebP, under 250KB
 *
 * Background / tour videos (UI loops):
 * - Longer edge ≤1280 · CRF 22 · mp4 +faststart · typically ≤1.5MB
 * - Use preload="metadata" for grid tiles; preload="auto" only for critical hero reels
 *
 * Example ffmpeg:
 *   ffmpeg -y -i input.mov \
 *     -vf "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease" \
 *     -c:v libx264 -crf 22 -preset medium -pix_fmt yuv420p \
 *     -movflags +faststart -an output.mp4
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
