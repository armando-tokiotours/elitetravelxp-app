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

function b64ToFile(b64: string, filename: string, mime: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export type OptimizedUploadResult = {
  file: File;
  /** First-frame still for video uploads (no-blink poster) */
  posterFile?: File;
  posterPath?: string;
};

export async function optimizeFileForUpload(
  file: File
): Promise<OptimizedUploadResult> {
  const video = isVideoFile(file);
  if (!video && !isOptimizableImage(file)) return { file };
  if (!video && file.type === "image/jpeg" && file.size < 80_000) {
    return { file };
  }
  if (video && file.size < 400_000 && /\.mp4$/i.test(file.name)) {
    return { file };
  }

  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/optimize-upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      console.warn("[optimizeFileForUpload] API", res.status);
      return { file };
    }

    const ctype = (res.headers.get("Content-Type") || "").toLowerCase();
    if (ctype.includes("application/json")) {
      const data = (await res.json()) as {
        kind?: string;
        videoBase64?: string;
        videoFilename?: string;
        videoMime?: string;
        posterBase64?: string | null;
        posterFilename?: string | null;
        posterMime?: string;
        posterPath?: string | null;
        error?: string;
      };
      if (data.error || !data.videoBase64) return { file };
      const out: OptimizedUploadResult = {
        file: b64ToFile(
          data.videoBase64,
          data.videoFilename || file.name.replace(/\.[^.]+$/, ".mp4"),
          data.videoMime || "video/mp4"
        ),
      };
      if (data.posterBase64 && data.posterFilename) {
        out.posterFile = b64ToFile(
          data.posterBase64,
          data.posterFilename,
          data.posterMime || "image/webp"
        );
      }
      if (data.posterPath) out.posterPath = data.posterPath;
      return out;
    }

    const blob = await res.blob();
    const name =
      res.headers.get("X-Optimized-Filename") ||
      file.name.replace(/\.[^.]+$/, video ? ".mp4" : ".jpg");
    return {
      file: new File([blob], name, {
        type:
          res.headers.get("Content-Type") ||
          (video ? "video/mp4" : "image/jpeg"),
      }),
    };
  } catch (e) {
    console.warn("[optimizeFileForUpload] failed, using original", e);
    return { file };
  }
}
