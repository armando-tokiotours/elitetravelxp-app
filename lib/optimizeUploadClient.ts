/**
 * Client helper: compress images via /api/admin/optimize-upload before PB upload.
 */
import { isOptimizableImage } from "@/lib/mediaThumbs";

export async function optimizeFileForUpload(file: File): Promise<File> {
  if (!isOptimizableImage(file)) return file;
  // Skip videos and already-small webps
  if (file.type.startsWith("video/")) return file;
  if (file.type === "image/webp" && file.size < 80_000) return file;

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
    const name =
      res.headers.get("X-Optimized-Filename") ||
      file.name.replace(/\.[^.]+$/, ".webp");
    return new File([blob], name, { type: "image/webp" });
  } catch (e) {
    console.warn("[optimizeFileForUpload] failed, using original", e);
    return file;
  }
}
