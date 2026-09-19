import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export { PB_THUMBS, isOptimizableImage } from "@/lib/mediaThumbs";

export type ImageVariant = "thumbnail" | "card" | "hero";

export interface ProcessedImageResult {
  /** 120×120 WebP — city pills / icons */
  thumbnailUrl: string;
  /** 600×400 WebP — tour / location cards */
  cardUrl: string;
  /** 1920×1080 WebP — hero banners */
  heroUrl: string;
  paths: {
    thumbnail: string;
    card: string;
    hero: string;
  };
}

export interface OptimizedUpload {
  buffer: Buffer;
  filename: string;
  /** JPEG for PocketBase thumb generation (PB 0.25 cannot thumb WebP reliably) */
  contentType: "image/jpeg";
  width: number;
  height: number;
  bytes: number;
}

/**
 * Write thumbnail / card / hero WebP variants next to `outputDir`.
 * Used by the batch optimizer and optional public/ upload paths.
 */
export async function processAndSaveImage(
  fileBuffer: Buffer,
  filename: string,
  outputDir: string,
  urlPrefix = "/images"
): Promise<ProcessedImageResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const baseName = path.parse(filename).name.replace(/-(thumb|card|hero)$/i, "");

  const thumbPath = path.join(outputDir, `${baseName}-thumb.webp`);
  const cardPath = path.join(outputDir, `${baseName}-card.webp`);
  const heroPath = path.join(outputDir, `${baseName}-hero.webp`);

  await sharp(fileBuffer)
    .rotate()
    .resize(120, 120, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(thumbPath);

  await sharp(fileBuffer)
    .rotate()
    .resize(600, 400, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(cardPath);

  await sharp(fileBuffer)
    .rotate()
    .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(heroPath);

  const prefix = urlPrefix.replace(/\/$/, "");
  return {
    thumbnailUrl: `${prefix}/${baseName}-thumb.webp`,
    cardUrl: `${prefix}/${baseName}-card.webp`,
    heroUrl: `${prefix}/${baseName}-hero.webp`,
    paths: {
      thumbnail: thumbPath,
      card: cardPath,
      hero: heroPath,
    },
  };
}

/**
 * Compress an upload for PocketBase storage.
 * Caps at hero size, outputs JPEG (mozjpeg) so PB can generate ?thumb= variants.
 * (PocketBase 0.25 returns the original file when thumb sizes aren't registered
 * or when the source is WebP without thumb support.)
 */
export async function optimizeUploadImage(
  fileBuffer: Buffer,
  originalName: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<OptimizedUpload> {
  const maxWidth = opts?.maxWidth ?? 1920;
  const maxHeight = opts?.maxHeight ?? 1080;
  const quality = opts?.quality ?? 82;

  const pipeline = sharp(fileBuffer).rotate().resize(maxWidth, maxHeight, {
    fit: "inside",
    withoutEnlargement: true,
  });

  const { data, info } = await pipeline
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const base = path.parse(originalName).name || "upload";
  return {
    buffer: data,
    filename: `${base}.jpg`,
    contentType: "image/jpeg",
    width: info.width,
    height: info.height,
    bytes: data.byteLength,
  };
}

/** Recompress an on-disk image in place (same path + format when possible). */
export async function recompressImageFile(
  filePath: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<{ before: number; after: number; skipped?: boolean }> {
  const beforeStat = await fs.stat(filePath);
  const before = beforeStat.size;
  const ext = path.extname(filePath).toLowerCase();
  const maxWidth = opts?.maxWidth ?? 1920;
  const maxHeight = opts?.maxHeight ?? 1080;
  const quality = opts?.quality ?? 82;

  // Skip already-tiny assets
  if (before < 40_000) {
    return { before, after: before, skipped: true };
  }

  const input = await fs.readFile(filePath);
  let pipeline = sharp(input).rotate().resize(maxWidth, maxHeight, {
    fit: "inside",
    withoutEnlargement: true,
  });

  let out: Buffer;
  if (ext === ".png") {
    out = await pipeline.png({ quality, compressionLevel: 9 }).toBuffer();
  } else if (ext === ".webp") {
    out = await pipeline.webp({ quality, effort: 4 }).toBuffer();
  } else if (ext === ".jpg" || ext === ".jpeg") {
    out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  } else {
    return { before, after: before, skipped: true };
  }

  // Only replace if we actually saved bytes
  if (out.byteLength >= before * 0.98) {
    return { before, after: before, skipped: true };
  }

  const tmp = `${filePath}.opt.tmp`;
  await fs.writeFile(tmp, out);
  await fs.rename(tmp, filePath);
  return { before, after: out.byteLength };
}
