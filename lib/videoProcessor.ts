/**
 * Server-only: optimize MP4/MOV uploads for fast mobile start via ffmpeg.
 * Keeps sharp resolution (max longer edge 1280) + H.264 +faststart.
 */
import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

export type OptimizedVideo = {
  buffer: Buffer;
  filename: string;
  contentType: "video/mp4";
  bytes: number;
  beforeBytes: number;
  /** First-frame WebP poster (for no-blink UI) */
  posterBuffer?: Buffer;
  posterFilename?: string;
};

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|qt)$/i;

export function isOptimizableVideo(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || "").toLowerCase();
  if (
    type.startsWith("video/") ||
    type === "application/mp4" ||
    type === "video/quicktime"
  ) {
    return true;
  }
  return VIDEO_EXT.test(file.name || "");
}

/** Prefer FFMPEG_PATH, then system `ffmpeg` (Docker apk). */
export function resolveFfmpegBin(): string {
  if (process.env.FFMPEG_PATH?.trim()) return process.env.FFMPEG_PATH.trim();
  return "ffmpeg";
}

/**
 * Grab a sharp still from ~0.1s into the clip (WebP).
 * Longer edge ≤1280 so posters stay light (~30–80 KB).
 */
export async function extractVideoPoster(
  fileBuffer: Buffer,
  originalName = "clip"
): Promise<{ buffer: Buffer; filename: string }> {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "tokio-poster-"));
  const inPath = path.join(tmpRoot, "in.bin");
  const outPath = path.join(tmpRoot, "poster.webp");
  await writeFile(inPath, fileBuffer);
  try {
    const { code, stderr } = await run(resolveFfmpegBin(), [
      "-y",
      "-ss",
      "0.05",
      "-i",
      inPath,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease",
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      outPath,
    ]);
    if (code !== 0) {
      // Fallback: jpeg via png pipe if webp encoder missing
      const jpgOut = path.join(tmpRoot, "poster.jpg");
      const r2 = await run(resolveFfmpegBin(), [
        "-y",
        "-ss",
        "0.05",
        "-i",
        inPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease",
        "-q:v",
        "3",
        jpgOut,
      ]);
      if (r2.code !== 0) {
        throw new Error(
          `poster extract failed: ${(stderr || r2.stderr).slice(-300)}`
        );
      }
      const jpg = await readFile(jpgOut);
      const base = path.parse(originalName).name || "clip";
      return { buffer: jpg, filename: `${base}-poster.jpg` };
    }
    const buffer = await readFile(outPath);
    const base = path.parse(originalName).name || "clip";
    return { buffer, filename: `${base}-poster.webp` };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function run(
  cmd: string,
  args: string[]
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/**
 * Re-encode to H.264 MP4:
 * - longer edge ≤1280 (sharp on phone retina, not huge)
 * - CRF 22 (visually clean)
 * - +faststart so playback begins before full download
 * - audio stripped (UI loops are muted)
 */
export async function optimizeUploadVideo(
  fileBuffer: Buffer,
  originalName: string
): Promise<OptimizedVideo> {
  const beforeBytes = fileBuffer.byteLength;
  // Already tiny — skip (likely already optimized)
  if (beforeBytes > 0 && beforeBytes < 400_000) {
    const base = path.parse(originalName).name || "clip";
    return {
      buffer: fileBuffer,
      filename: `${base}.mp4`,
      contentType: "video/mp4",
      bytes: beforeBytes,
      beforeBytes,
    };
  }

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "tokio-vid-"));
  const inPath = path.join(tmpRoot, "in.bin");
  const outPath = path.join(tmpRoot, "out.mp4");
  await writeFile(inPath, fileBuffer);

  try {
    const heavy = beforeBytes > 8_000_000;
    const maxEdge = heavy ? 960 : 1280;
    const crf = heavy ? "26" : "22";
    const { code, stderr } = await run(resolveFfmpegBin(), [
      "-y",
      "-i",
      inPath,
      "-vf",
      `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      crf,
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      "-an",
      outPath,
    ]);

    if (code !== 0) {
      throw new Error(
        `ffmpeg failed (${code}): ${stderr.slice(-400) || "no stderr"}`
      );
    }

    const out = await readFile(outPath);
    // Prefer optimized only if smaller or within 5% (faststart can grow tiny files)
    const buffer =
      out.byteLength < beforeBytes * 1.05 ? out : fileBuffer;
    const base = path.parse(originalName).name || "clip";
    let posterBuffer: Buffer | undefined;
    let posterFilename: string | undefined;
    try {
      const poster = await extractVideoPoster(buffer, base);
      posterBuffer = poster.buffer;
      posterFilename = poster.filename;
    } catch (err) {
      console.warn("[optimizeUploadVideo] poster extract skipped", err);
    }
    return {
      buffer,
      filename: `${base}.mp4`,
      contentType: "video/mp4",
      bytes: buffer.byteLength,
      beforeBytes,
      posterBuffer,
      posterFilename,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
