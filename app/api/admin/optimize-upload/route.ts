/**
 * POST /api/admin/optimize-upload
 * Compresses an image to WebP (max 1920×1080) for Team Access → PocketBase uploads.
 * Body: multipart form field `file`
 * Response: image/webp binary with X-Optimized-* headers
 */
import { NextRequest, NextResponse } from "next/server";
import {
  isOptimizableImage,
  optimizeUploadImage,
} from "@/lib/imageProcessor";

export const runtime = "nodejs";

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
    if (!isOptimizableImage(file)) {
      return NextResponse.json(
        { error: "Not an optimizable image type" },
        { status: 415 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // Skip tiny already-optimized assets
    if (buf.byteLength < 50_000 && file.type === "image/webp") {
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "X-Optimized-Filename": file.name,
          "X-Optimized-Skipped": "1",
          "X-Optimized-Bytes": String(buf.byteLength),
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
