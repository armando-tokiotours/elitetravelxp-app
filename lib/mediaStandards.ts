/**
 * VPS / content media standards for Elite Travel XP.
 *
 * Image targets (export before upload to PocketBase):
 * - Hero banners: 1920×1080 max, WebP, under 250KB
 * - Card / location images: 800×600 max, WebP, under 80KB
 *
 * Background / tour videos:
 * - Max resolution 1080p
 * - Bitrate ~1.5 Mbps
 * - Format .mp4 (H.264) and/or .webm (VP9)
 * - File size under 5MB
 *
 * Example ffmpeg one-liner:
 *   ffmpeg -i input.mov -vf "scale=-2:1080" -c:v libx264 -b:v 1500k \
 *     -c:a aac -b:a 96k -movflags +faststart output.mp4
 */
export const MEDIA_STANDARDS = {
  hero: { maxWidth: 1920, maxHeight: 1080, maxBytes: 250_000 },
  card: { maxWidth: 800, maxHeight: 600, maxBytes: 80_000 },
  video: {
    maxHeight: 1080,
    targetBitrateKbps: 1500,
    maxBytes: 5_000_000,
    formats: ["mp4", "webm"] as const,
  },
  imageSizesDefault: "(max-width: 768px) 100vw, 50vw",
} as const;
