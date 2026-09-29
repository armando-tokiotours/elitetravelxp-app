import { existsSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  BRAND_CHARACTERS,
  formatBytes,
  getBrandCharacter,
  weightStatus,
  type BrandCharacterDef,
} from "@/lib/brandCharacters";

export const runtime = "nodejs";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");

function uploadsAllowed() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_PUBLIC_ASSET_WRITE === "true"
  );
}

function publicPathToDisk(publicPath: string): string {
  const rel = publicPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", ...rel.split("/"));
}

async function probeFile(publicPath: string): Promise<{
  exists: boolean;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  mtime: string | null;
}> {
  const disk = publicPathToDisk(publicPath);
  if (!existsSync(disk)) {
    return {
      exists: false,
      bytes: null,
      width: null,
      height: null,
      format: null,
      mtime: null,
    };
  }
  const st = statSync(disk);
  let width: number | null = null;
  let height: number | null = null;
  let format: string | null = path.extname(disk).replace(".", "").toLowerCase() || null;
  try {
    const meta = await sharp(disk).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    if (meta.format) format = meta.format;
  } catch {
    /* non-image or unreadable */
  }
  return {
    exists: true,
    bytes: st.size,
    width,
    height,
    format,
    mtime: st.mtime.toISOString(),
  };
}

export type BrandCharacterRow = BrandCharacterDef & {
  exists: boolean;
  bytes: number | null;
  bytesLabel: string;
  width: number | null;
  height: number | null;
  format: string | null;
  mtime: string | null;
  status: "ok" | "heavy" | "missing";
  currentLabel: string;
  optimalLabel: string;
};

async function buildRow(def: BrandCharacterDef): Promise<BrandCharacterRow> {
  const probe = await probeFile(def.path);
  const status = weightStatus(
    probe.bytes,
    probe.width,
    probe.height,
    def.optimal
  );
  const dims =
    probe.width && probe.height
      ? `${probe.width}×${probe.height}`
      : "—";
  const fmt = (probe.format || path.extname(def.path).replace(".", "") || "?")
    .toUpperCase();
  const currentLabel = probe.exists
    ? `${dims} · ${fmt} · ${formatBytes(probe.bytes || 0)}`
    : "Missing file";
  const optimalLabel = `≤${def.optimal.maxEdgePx}px · ~${def.optimal.maxKb} KB · ${def.optimal.formatHint}`;

  return {
    ...def,
    exists: probe.exists,
    bytes: probe.bytes,
    bytesLabel: formatBytes(probe.bytes || 0),
    width: probe.width,
    height: probe.height,
    format: probe.format,
    mtime: probe.mtime,
    status,
    currentLabel,
    optimalLabel,
  };
}

/**
 * GET /api/admin/brand-characters — catalog with current vs optimal weight.
 * POST — replace file for a registered character id (multipart: id + file).
 */
export async function GET() {
  try {
    const items = await Promise.all(BRAND_CHARACTERS.map(buildRow));
    const heavy = items.filter((i) => i.status === "heavy").length;
    const missing = items.filter((i) => i.status === "missing").length;
    return NextResponse.json({
      ok: true,
      summary: {
        total: items.length,
        heavy,
        missing,
        ok: items.length - heavy - missing,
      },
      items,
    });
  } catch (err) {
    console.error("[brand-characters] GET", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to list brand characters",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!uploadsAllowed()) {
    return NextResponse.json(
      {
        error:
          "Saving to public/ is disabled. Set ALLOW_PUBLIC_ASSET_WRITE=true or use local development.",
      },
      { status: 403 }
    );
  }

  try {
    const form = await req.formData();
    const id = String(form.get("id") || "").trim();
    const file = form.get("file");
    const def = getBrandCharacter(id);
    if (!def) {
      return NextResponse.json({ error: "Unknown character id." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image is too large (max 12 MB)." },
        { status: 400 }
      );
    }

    const disk = publicPathToDisk(def.path);
    // Keep the registered filename/extension so live code paths stay stable
    const targetExt = path.extname(disk).toLowerCase() || ".webp";
    const mime = (file.type || "").toLowerCase();
    let buffer = Buffer.from(await file.arrayBuffer());

    // Normalize: characters → WebP (PNG/JPG uploads auto-convert); heroes stay JPG
    try {
      let pipeline = sharp(buffer).rotate();
      const meta = await pipeline.metadata();
      const maxEdge = Math.max(meta.width || 0, meta.height || 0);
      if (maxEdge > def.optimal.maxEdgePx) {
        pipeline = pipeline.resize({
          width: def.optimal.maxEdgePx,
          height: def.optimal.maxEdgePx,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      if (targetExt === ".jpg" || targetExt === ".jpeg") {
        buffer = Buffer.from(
          await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
        );
      } else if (targetExt === ".webp") {
        buffer = Buffer.from(
          await pipeline.webp({ quality: 90, alphaQuality: 100 }).toBuffer()
        );
      } else {
        // Legacy PNG slots — still convert to WebP if path was updated
        buffer = Buffer.from(
          await pipeline.webp({ quality: 90, alphaQuality: 100 }).toBuffer()
        );
      }
    } catch {
      // Fall back to raw bytes if sharp fails
      if (
        mime &&
        !mime.includes(targetExt.replace(".", "")) &&
        !(targetExt === ".jpg" && mime.includes("jpeg")) &&
        !(targetExt === ".webp" && (mime.includes("png") || mime.includes("jpeg")))
      ) {
        return NextResponse.json(
          {
            error: `This slot expects ${targetExt}. Upload PNG, JPG, or WebP.`,
          },
          { status: 400 }
        );
      }
    }

    await writeFile(disk, buffer);
    const row = await buildRow(def);
    const savedExt = path.extname(def.path).replace(".", "").toUpperCase();
    return NextResponse.json({
      ok: true,
      path: def.path,
      absolute: path.relative(process.cwd(), disk),
      item: row,
      note:
        targetExt === ".webp" && !mime.includes("webp")
          ? `Converted upload → ${savedExt} (q90 · ≤${def.optimal.maxEdgePx}px).`
          : `Saved as ${savedExt}.`,
    });
  } catch (err) {
    console.error("[brand-characters] POST", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to replace character file",
      },
      { status: 500 }
    );
  }
}
