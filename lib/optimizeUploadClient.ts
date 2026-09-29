/**
 * Client helper: compress images/videos via /api/admin/optimize-upload
 * before PocketBase upload.
 */
import { isOptimizableImage } from "@/lib/mediaThumbs";

function isVideoFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/") || type === "application/mp4") return true;
  return /\.(mp4|m4v|mov|webm|qt)$/i.test(file.name || "");
}

export async function optimizeFileForUpload(file: File): Promise<File> {
  const video = isVideoFile(file);
  if (!video && !isOptimizableImage(file)) return file;
  if (!video && file.type === "image/jpeg" && file.size < 80_000) return file;
  // Already small web-ready clip
  if (video && file.size < 400_000 && /\.mp4$/i.test(file.name)) return file;

  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/optimize-upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      console.warn("[optimizeFileForUpload] API", res.status);
      return file;
    }
    const blob = await res.blob();
    const fallbackExt = video ? ".mp4" : ".jpg";
    const fallbackType = video ? "video/mp4" : "image/jpeg";
    const name =
      res.headers.get("X-Optimized-Filename") ||
      file.name.replace(/\.[^.]+$/, fallbackExt);
    return new File([blob], name, {
      type: res.headers.get("Content-Type") || fallbackType,
    });
  } catch (e) {
    console.warn("[optimizeFileForUpload] failed, using original", e);
    return file;
  }
}
