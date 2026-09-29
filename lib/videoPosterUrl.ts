/** Client-safe: poster URL for any video src (hits cache API). */
export function videoPosterUrlForSrc(videoSrc: string): string {
  const src = (videoSrc || "").trim();
  if (!src) return "";
  return `/api/branding/video-poster?src=${encodeURIComponent(src)}`;
}
