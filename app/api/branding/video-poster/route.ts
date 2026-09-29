/**
 * GET /api/branding/video-poster?src=<videoUrl>
 * Returns a cached first-frame WebP (generates once via ffmpeg).
 */
import { NextRequest, NextResponse } from "next/server";
import { extractVideoPoster } from "@/lib/videoProcessor";
import {
  readCachedPoster,
  videoPosterCacheKey,
  writeCachedPoster,
} from "@/lib/videoPosterCache";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchVideoBuffer(src: string): Promise<Buffer> {
  // Absolute URL (PB / CDN)
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src, { cache: "force-cache" });
    if (!res.ok) throw new Error(`fetch video ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Same-origin relative
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000";
  const url = src.startsWith("/") ? `${origin.replace(/\/$/, "")}${src}` : src;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`fetch video ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(req: NextRequest) {
  const src = (req.nextUrl.searchParams.get("src") || "").trim();
  if (!src || src.length > 2000) {
    return NextResponse.json({ error: "Missing src" }, { status: 400 });
  }
  if (!/\.(mp4|m4v|mov|webm)(\?|$)/i.test(src) && !src.includes("/api/files/")) {
    // Allow PB file URLs without extension in query; still require video-ish path
    if (!src.includes("files/")) {
      return NextResponse.json({ error: "Not a video src" }, { status: 400 });
    }
  }

  const key = videoPosterCacheKey(src);
  const cached = await readCachedPoster(key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Poster-Cache": "hit",
        "X-Poster-Path": cached.publicPath,
      },
    });
  }

  try {
    const videoBuf = await fetchVideoBuffer(src);
    const poster = await extractVideoPoster(videoBuf, "frame");
    const written = await writeCachedPoster(key, poster.buffer, poster.filename);
    return new NextResponse(new Uint8Array(poster.buffer), {
      status: 200,
      headers: {
        "Content-Type": written.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Poster-Cache": "miss",
        "X-Poster-Path": written.publicPath,
      },
    });
  } catch (e) {
    console.error("[video-poster]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Poster failed" },
      { status: 500 }
    );
  }
}
