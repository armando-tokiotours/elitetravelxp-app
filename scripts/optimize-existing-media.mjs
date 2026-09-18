/**
 * One-time / on-demand media optimization for public/ and PocketBase storage.
 *
 * Usage:
 *   node scripts/optimize-existing-media.mjs
 *   node scripts/optimize-existing-media.mjs --pb
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PUBLIC_IMAGES = path.join(ROOT, "public", "images");
const PB_STORAGE = path.join(ROOT, "backend", "pb_data", "storage");
const INCLUDE_PB = process.argv.includes("--pb");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const SKIP_NAME = /(thumb|card|hero)\.webp$/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

async function writeVariants(filePath, outDir, baseName) {
  const input = await sharp(filePath).rotate().toBuffer();

  await sharp(input)
    .resize(120, 120, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(path.join(outDir, `${baseName}-thumb.webp`));

  await sharp(input)
    .resize(600, 400, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(outDir, `${baseName}-card.webp`));

  await sharp(input)
    .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(path.join(outDir, `${baseName}-hero.webp`));
}

async function recompressInPlace(filePath) {
  const before = fs.statSync(filePath).size;
  if (before < 40_000) return { before, after: before, skipped: true };

  const ext = path.extname(filePath).toLowerCase();
  const input = fs.readFileSync(filePath);
  const pipeline = sharp(input)
    .rotate()
    .resize(1920, 1080, { fit: "inside", withoutEnlargement: true });

  let out;
  if (ext === ".png") {
    out = await pipeline.png({ quality: 82, compressionLevel: 9 }).toBuffer();
  } else if (ext === ".webp") {
    out = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
  } else if (ext === ".jpg" || ext === ".jpeg") {
    out = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } else {
    return { before, after: before, skipped: true };
  }

  if (out.byteLength >= before * 0.98) {
    return { before, after: before, skipped: true };
  }

  const tmp = `${filePath}.opt.tmp`;
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, filePath);
  return { before, after: out.byteLength };
}

async function optimizePublicImages() {
  console.log("→ Optimizing public/images …");
  if (!fs.existsSync(PUBLIC_IMAGES)) {
    console.log("  (missing, skip)");
    return;
  }

  const files = walk(PUBLIC_IMAGES).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f);
    return IMAGE_EXT.has(ext) && !SKIP_NAME.test(base);
  });

  let ok = 0;
  for (const file of files) {
    const baseName = path.parse(file).name.replace(/-(thumb|card|hero)$/i, "");
    const outDir = path.dirname(file);
    try {
      await writeVariants(file, outDir, baseName);
      const r = await recompressInPlace(file);
      const saved = r.skipped
        ? "kept"
        : `${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(0)}KB`;
      console.log(`  ✓ ${path.relative(ROOT, file)} (${saved})`);
      ok += 1;
    } catch (e) {
      console.warn(`  ✗ ${path.relative(ROOT, file)}: ${e.message || e}`);
    }
  }
  console.log(`  Done: ${ok}/${files.length} public images`);
}

async function optimizePbStorage() {
  console.log("→ Recompressing PocketBase storage (in place, same filenames) …");
  if (!fs.existsSync(PB_STORAGE)) {
    console.log("  (missing, skip)");
    return;
  }

  const files = walk(PB_STORAGE).filter((f) =>
    IMAGE_EXT.has(path.extname(f).toLowerCase())
  );

  let ok = 0;
  let savedBytes = 0;
  for (const file of files) {
    try {
      const r = await recompressInPlace(file);
      if (!r.skipped) {
        savedBytes += r.before - r.after;
        console.log(
          `  ✓ ${path.relative(ROOT, file)} ${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(0)}KB`
        );
        ok += 1;
      }
    } catch (e) {
      console.warn(`  ✗ ${path.relative(ROOT, file)}: ${e.message || e}`);
    }
  }
  console.log(
    `  Done: recompressed ${ok} files, saved ~${(savedBytes / 1024 / 1024).toFixed(1)} MB`
  );
}

async function main() {
  console.log("Starting batch media optimization…");
  await optimizePublicImages();
  if (INCLUDE_PB) {
    await optimizePbStorage();
  } else {
    console.log("Tip: pass --pb to also recompress backend/pb_data/storage");
  }
  console.log("All media optimization finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
