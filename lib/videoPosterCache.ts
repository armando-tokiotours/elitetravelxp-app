/**
 * Disk cache for video posters under public/brand/video-posters/.
 */
import { createHash } from "crypto";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";

export const VIDEO_POSTER_DIR = path.join(
  process.cwd(),
  "public",
  "brand",
  "video-posters"
);

export function videoPosterCacheKey(src: string): string {
  return createHash("sha1").update(src).digest("hex").slice(0, 20);
}

export function videoPosterPublicPath(key: string, ext = "webp"): string {
  return `/brand/video-posters/${key}.${ext}`;
}

export function videoPosterDiskPath(key: string, ext = "webp"): string {
  return path.join(VIDEO_POSTER_DIR, `${key}.${ext}`);
}

export async function ensurePosterDir(): Promise<void> {
  await mkdir(VIDEO_POSTER_DIR, { recursive: true });
}

export async function readCachedPoster(
  key: string
): Promise<{ buffer: Buffer; contentType: string; publicPath: string } | null> {
  for (const [ext, type] of [
    ["webp", "image/webp"],
    ["jpg", "image/jpeg"],
  ] as const) {
    const disk = videoPosterDiskPath(key, ext);
    try {
      await access(disk);
      const buffer = await readFile(disk);
      return {
        buffer,
        contentType: type,
        publicPath: videoPosterPublicPath(key, ext),
      };
    } catch {
      /* miss */
    }
  }
  return null;
}

export async function writeCachedPoster(
  key: string,
  buffer: Buffer,
  filenameHint: string
): Promise<{ publicPath: string; contentType: string }> {
  await ensurePosterDir();
  const ext = filenameHint.toLowerCase().endsWith(".jpg") ? "jpg" : "webp";
  const disk = videoPosterDiskPath(key, ext);
  await writeFile(disk, buffer);
  return {
    publicPath: videoPosterPublicPath(key, ext),
    contentType: ext === "jpg" ? "image/jpeg" : "image/webp",
  };
}
