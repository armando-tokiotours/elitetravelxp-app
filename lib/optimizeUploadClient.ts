/**
 * Client helper: compress images via /api/admin/optimize-upload before PB upload.
 */
import { isOptimizableImage } from "@/lib/mediaThumbs";

export async function optimizeFileForUpload(file: File): Promise<File> {
  if (!isOptimizableImage(file)) return file;
  if (file.type.startsWith("video/")) return file;
  if (file.type === "image/jpeg" && file.size < 80_000) return file;

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
      file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], name, {
      type: res.headers.get("Content-Type") || "image/jpeg",
    });
  } catch (e) {
    console.warn("[optimizeFileForUpload] failed, using original", e);
    return file;
  }
}
