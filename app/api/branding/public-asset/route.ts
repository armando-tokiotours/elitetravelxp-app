import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");
const ASSETS_META = path.join(BRAND_DIR, "assets.json");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type AssetKind = "hero" | "logo";

const BASENAME: Record<AssetKind, string> = {
  hero: "hero-background",
  logo: "site-logo",
};

function uploadsAllowed() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_PUBLIC_ASSET_WRITE === "true"
  );
}

async function readMeta(): Promise<Record<string, string>> {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(ASSETS_META, "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Saves a branding image into `public/brand/` so it ships with the project.
 * Body: multipart form with `file` + `kind` (`hero` | `logo`).
 */
export async function POST(request: Request) {
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
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") || "hero");
    const kind: AssetKind = kindRaw === "logo" ? "logo" : "hero";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    let ext = EXT_BY_MIME[mime];
    if (!ext) {
      const fromName = file.name.split(".").pop()?.toLowerCase();
      if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
        ext = fromName === "jpeg" ? "jpg" : fromName;
      }
    }
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPG, PNG, or WebP." },
        { status: 400 }
      );
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image is too large (max 12 MB)." },
        { status: 400 }
      );
    }

    await mkdir(BRAND_DIR, { recursive: true });

    const base = BASENAME[kind];
    // Remove previous hero/logo variants so only one active file remains
    const existing = await readdir(BRAND_DIR);
    await Promise.all(
      existing
        .filter((name) => name.startsWith(`${base}.`))
        .map((name) => unlink(path.join(BRAND_DIR, name)).catch(() => undefined))
    );

    const filename = `${base}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(BRAND_DIR, filename), buffer);

    const publicPath = `/brand/${filename}`;
    const meta = await readMeta();
    meta[kind] = publicPath;
    await writeFile(ASSETS_META, JSON.stringify(meta, null, 2) + "\n", "utf8");

    return NextResponse.json({
      ok: true,
      kind,
      path: publicPath,
      absolute: path.join("public", "brand", filename),
    });
  } catch (e) {
    console.error("[branding/public-asset]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save asset." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const meta = await readMeta();
  return NextResponse.json(meta);
}
