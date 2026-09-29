/**
 * POST /api/admin/optimize-upload
 * Images → JPEG ≤1920×1080 for PocketBase thumbs.
 * Videos → JSON { videoBase64, posterBase64, … } H.264 + first-frame poster.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  isOptimizableImage,
  optimizeUploadImage,
} from "@/lib/imageProcessor";
import {
  isOptimizableVideo,
  optimizeUploadVideo,
} from "@/lib/videoProcessor";
import {
  videoPosterCacheKey,
  writeCachedPoster,
} from "@/lib/videoPosterCache";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (isOptimizableVideo(file)) {
      const result = await optimizeUploadVideo(buf, file.name);
      let posterPath = "";
      if (result.posterBuffer && result.posterFilename) {
        const key = videoPosterCacheKey(
          `upload:${result.filename}:${result.bytes}`
        );
        const written = await writeCachedPoster(
          key,
          result.posterBuffer,
          result.posterFilename
        );
        posterPath = written.publicPath;
      }
      return NextResponse.json({
        kind: "video",
        videoBase64: result.buffer.toString("base64"),
        videoFilename: result.filename,
        videoMime: result.contentType,
        posterBase64: result.posterBuffer
          ? result.posterBuffer.toString("base64")
          : null,
        posterFilename: result.posterFilename || null,
        posterMime: result.posterFilename?.endsWith(".jpg")
          ? "image/jpeg"
          : "image/webp",
        posterPath: posterPath || null,
        bytes: result.bytes,
        beforeBytes: result.beforeBytes,
      });
    }

    if (!isOptimizableImage(file)) {
      return NextResponse.json(
        { error: "Not an optimizable image or video type" },
        { status: 415 }
      );
    }

    if (buf.byteLength < 50_000 && file.type === "image/jpeg") {
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "X-Optimized-Filename": file.name,
          "X-Optimized-Skipped": "1",
          "X-Optimized-Bytes": String(buf.byteLength),
          "X-Optimized-Kind": "image",
        },
      });
    }

    const result = await optimizeUploadImage(buf, file.name);
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "X-Optimized-Filename": result.filename,
        "X-Optimized-Width": String(result.width),
        "X-Optimized-Height": String(result.height),
        "X-Optimized-Bytes": String(result.bytes),
        "X-Optimized-Before": String(buf.byteLength),
        "X-Optimized-Kind": "image",
      },
    });
  } catch (e) {
    console.error("[optimize-upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Optimize failed" },
      { status: 500 }
    );
  }
}
