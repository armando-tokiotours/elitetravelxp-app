/**
 * VPS local media under public/uploads/{folder}/…
 * Public URL pointer: /uploads/{folder}/{filename}
 * Keeps PocketBase records light (store URL, not binary).
 *
 * Client UI must import types from vpsMediaTypes — not this file.
 */

import "server-only";

import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  VPS_MEDIA_FOLDERS,
  isAllowedMediaFolder,
  type VpsMediaFile,
} from "@/lib/vpsMediaTypes";

export {
  VPS_MEDIA_FOLDERS,
  isAllowedMediaFolder,
  type VpsMediaFile,
  type VpsMediaFolder,
} from "@/lib/vpsMediaTypes";

const MAX_BYTES = 55 * 1024 * 1024; // 55MB (hero-panel video ≤50MB + catalog headroom)

export function uploadsRootDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

function sanitizeFileName(raw: string): string {
  const base = String(raw || "file")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return base || "file";
}

/** Resolve /uploads/... to absolute path; reject traversal. */
export function publicUploadUrlToAbsolute(fileUrl: string): string | null {
  const raw = String(fileUrl || "").trim();
  if (!raw) return null;

  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) pathname = new URL(raw).pathname;
  } catch {
    return null;
  }

  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!normalized.startsWith("/uploads/")) return null;
  if (normalized.includes("..")) return null;

  const relative = normalized.replace(/^\/uploads\//, "");
  const segments = relative.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  if (!isAllowedMediaFolder(segments[0])) return null;
  if (segments.some((s) => s === ".." || s === ".")) return null;

  const abs = path.resolve(uploadsRootDir(), ...segments);
  const root = path.resolve(uploadsRootDir());
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

/** Web master width for branding images (px). */
export const BRANDING_WEB_MAX_WIDTH = 1600;
/** Mobile proxy width for branding images (px) — good definition, light. */
export const BRANDING_MOBILE_MAX_WIDTH = 768;

const RASTER_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".tif",
  ".tiff",
]);

export async function writeVpsMediaFile(opts: {
  folder: string;
  fileName: string;
  buffer: Buffer;
  /**
   * Stable slot key (e.g. "hero-panel-p1"). When set, the file is written
   * to `{stableKey}{ext}` and OVERWRITES any previous file for that slot
   * (including stale same-stem files with a different extension), so the
   * public URL never changes and no orphans accumulate.
   *
   * Branding images (`folder: "branding"` + stableKey + raster image) are
   * stored ONLY as two WebP derivatives of the same slot:
   * `{key}.webp` (web, ≤1600w q80) and `{key}--mobile.webp` (≤768w q75).
   * The original upload is never kept, and stale same-slot files (any
   * extension, incl. an old `--mobile`) are deleted — replace = overwrite,
   * same ID, no orphans.
   */
  stableKey?: string;
}): Promise<{
  url: string;
  fileName: string;
  folder: string;
  size: number;
  mobileUrl?: string;
  mobileSize?: number;
}> {
  const folder = sanitizeFileName(opts.folder).toLowerCase() || "general";
  if (!isAllowedMediaFolder(folder)) {
    throw new Error(`Folder not allowed: ${folder}`);
  }
  if (opts.buffer.byteLength > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / (1024 * 1024)}MB)`);
  }

  const clean = sanitizeFileName(opts.fileName);
  const dir = path.join(uploadsRootDir(), folder);
  await mkdir(dir, { recursive: true });

  const stableStem = String(opts.stableKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const ext = path.extname(clean).toLowerCase() || ".bin";

  // Branding + catalog raster images with a stable slot → web + mobile WebP pair.
  // Catalog stableKey is `{recordId}_{index}` (see lib/catalogMedia.ts), so a
  // catalog photo gets exactly the branding treatment: `{id}_1.webp` +
  // `{id}_1--mobile.webp`, overwritten in place, stale same-stem files deleted.
  // Videos (mp4/webm/…) are not raster: they fall through to the generic
  // stable-stem path below and keep the same `{recordId}_1` stem + own ext.
  if (
    (folder === "branding" || folder === "catalog") &&
    stableStem &&
    RASTER_IMAGE_EXTS.has(ext)
  ) {
    const sharp = (await import("sharp")).default;
    const webName = `${stableStem}.webp`;
    const mobileName = `${stableStem}--mobile.webp`;
    const webBuf = await sharp(opts.buffer)
      .rotate()
      .resize({ width: BRANDING_WEB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const mobileBuf = await sharp(opts.buffer)
      .rotate()
      .resize({ width: BRANDING_MOBILE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    // Delete every stale same-slot file (old ext, old pair, timestamped
    // strays are impossible here because stable slots never timestamp).
    try {
      for (const name of await readdir(dir)) {
        const stem = path.parse(name).name;
        if (stem === stableStem || stem === `${stableStem}--mobile`) {
          if (name !== webName && name !== mobileName) {
            await unlink(path.join(dir, name)).catch(() => {});
          }
        }
      }
    } catch {
      /* dir was just created — nothing stale */
    }
    await writeFile(path.join(dir, webName), webBuf);
    await writeFile(path.join(dir, mobileName), mobileBuf);
    return {
      url: `/uploads/${folder}/${webName}`,
      fileName: webName,
      folder,
      size: webBuf.byteLength,
      mobileUrl: `/uploads/${folder}/${mobileName}`,
      mobileSize: mobileBuf.byteLength,
    };
  }

  let fileName: string;
  if (stableStem) {
    fileName = `${stableStem}${ext}`;
    // Remove stale same-slot files with a different extension so an
    // upload that changes format (jpg → webp, mp4 → webm) leaves no orphan.
    try {
      for (const name of await readdir(dir)) {
        if (name === fileName) continue;
        if (path.parse(name).name === stableStem) {
          await unlink(path.join(dir, name)).catch(() => {});
        }
      }
    } catch {
      /* dir was just created — nothing stale */
    }
  } else {
    fileName = `${Date.now()}_${clean}`;
  }
  const abs = path.join(dir, fileName);
  await writeFile(abs, opts.buffer);

  return {
    url: `/uploads/${folder}/${fileName}`,
    fileName,
    folder,
    size: opts.buffer.byteLength,
  };
}

export async function listVpsMediaFiles(): Promise<VpsMediaFile[]> {
  const root = uploadsRootDir();
  const out: VpsMediaFile[] = [];

  async function walk(folderRel: string, absDir: string) {
    let entries: string[];
    try {
      entries = await readdir(absDir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const abs = path.join(absDir, name);
      const st = await stat(abs).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) {
        // tickets/{PNR}/{item}/file.pdf nesting
        await walk(`${folderRel}/${name}`, abs);
        continue;
      }
      if (!st.isFile()) continue;
      const urlPath = `/uploads/${folderRel}/${name}`.replace(/\/+/g, "/");
      const top = folderRel.split("/")[0] || "general";
      out.push({
        fileName: name,
        folder: top,
        url: urlPath,
        sizeBytes: st.size,
        updatedAt: st.mtime.toISOString(),
        isImage: /\.(jpe?g|png|webp|gif|svg)$/i.test(name),
        isVideo: /\.(mp4|webm|mov|m4v)$/i.test(name),
        isPdf: /\.pdf$/i.test(name),
      });
    }
  }

  for (const folder of VPS_MEDIA_FOLDERS) {
    await walk(folder, path.join(root, folder));
  }

  out.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return out;
}

export async function deleteVpsMediaFile(fileUrl: string): Promise<string> {
  const abs = publicUploadUrlToAbsolute(fileUrl);
  if (!abs) throw new Error("Invalid file path");
  await unlink(abs);
  return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
}
