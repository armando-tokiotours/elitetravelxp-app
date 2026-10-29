#!/usr/bin/env node
/**
 * Local catalog media hygiene:
 * 1) For every `{slot}.webp` missing `{slot}--mobile.webp`, generate the mobile proxy.
 * 2) Optionally (default on): for every photo-collection PocketBase record missing
 *    `{id}_1.webp`, create the white labelled placeholder (+ mobile pair).
 *
 * Usage:
 *   node scripts/catalog-ensure-media.mjs
 *   node scripts/catalog-ensure-media.mjs --no-pb
 *   PB_URL=http://127.0.0.1:8090 node scripts/catalog-ensure-media.mjs
 *
 * Never overwrites an existing `{slot}.webp` (real photo or earlier placeholder).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import PocketBase from "pocketbase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOG_DIR = path.join(ROOT, "public", "uploads", "catalog");
const SKIP_PB = process.argv.includes("--no-pb");
const WEB_MAX = 1600;
const MOBILE_MAX = 768;

const PHOTO_COLLECTIONS = [
  "cities",
  "tours",
  "experiences_and_places",
  "vehicles",
  "transport_products",
  "hubs",
  "seasonal_highlights",
  "feature_explainers",
];

function catalogSlot(recordId, index = 1) {
  const id = String(recordId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const n = Math.max(1, Math.floor(Number(index) || 1));
  return id ? `${id}_${n}` : "";
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title, perLine = 34, maxLines = 2) {
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > perLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const consumed = lines.join(" ").split(" ").filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…?$/, "")}…`;
  }
  return lines;
}

function renderPlaceholderSvg(slot, title) {
  const safeSlot = xmlEscape(slot);
  const titleLines = wrapTitle(title || slot);
  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="600" y="${520 + i * 52}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="600" fill="#1a1a1a">${xmlEscape(line)}</text>`
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect x="0" y="0" width="1200" height="900" fill="#ffffff"/>
  <rect x="24" y="24" width="1152" height="852" fill="none" stroke="#054F70" stroke-width="8"/>
  <text x="600" y="440" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="62" font-weight="700" fill="#054F70">${safeSlot}</text>
  ${titleSvg}
  <text x="600" y="700" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#666666">PLACEHOLDER — replace ${safeSlot} photo</text>
</svg>`;
}

async function writeWebMobilePair(slot, inputBuffer) {
  const webName = `${slot}.webp`;
  const mobileName = `${slot}--mobile.webp`;
  const webBuf = await sharp(inputBuffer)
    .rotate()
    .resize({ width: WEB_MAX, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const mobileBuf = await sharp(inputBuffer)
    .rotate()
    .resize({ width: MOBILE_MAX, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  fs.writeFileSync(path.join(CATALOG_DIR, webName), webBuf);
  fs.writeFileSync(path.join(CATALOG_DIR, mobileName), mobileBuf);
}

async function ensureMobilePairs() {
  fs.mkdirSync(CATALOG_DIR, { recursive: true });
  const names = fs.readdirSync(CATALOG_DIR).filter((n) => n.endsWith(".webp"));
  const webSlots = names
    .filter((n) => !n.includes("--mobile"))
    .map((n) => path.parse(n).name);
  let created = 0;
  let skipped = 0;
  for (const slot of webSlots) {
    const mobilePath = path.join(CATALOG_DIR, `${slot}--mobile.webp`);
    if (fs.existsSync(mobilePath)) {
      skipped += 1;
      continue;
    }
    const webPath = path.join(CATALOG_DIR, `${slot}.webp`);
    const buf = fs.readFileSync(webPath);
    const mobileBuf = await sharp(buf)
      .rotate()
      .resize({ width: MOBILE_MAX, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    fs.writeFileSync(mobilePath, mobileBuf);
    created += 1;
    console.log(`  + mobile ${slot}--mobile.webp`);
  }
  return { created, skipped, totalWeb: webSlots.length };
}

function recordTitle(rec) {
  return (
    rec?.title ||
    rec?.name ||
    rec?.label ||
    rec?.display_name ||
    rec?.id ||
    ""
  );
}

async function ensurePlaceholdersFromPb() {
  const url = process.env.PB_URL || "http://127.0.0.1:8090";
  const email =
    process.env.PB_ADMIN_EMAIL ||
    process.env.POCKETBASE_ADMIN_EMAIL ||
    "";
  const password =
    process.env.PB_ADMIN_PASSWORD ||
    process.env.POCKETBASE_ADMIN_PASSWORD ||
    "";

  const pb = new PocketBase(url);
  if (email && password) {
    await pb.collection("_superusers").authWithPassword(email, password);
  } else {
    // Try common local admin from package scripts if env not set — fail soft.
    try {
      await pb
        .collection("_superusers")
        .authWithPassword(
          "admin@tokiotours-app.com",
          "EliteTravelAdmin2026!"
        );
    } catch (err) {
      console.warn(
        `⚠ PocketBase auth failed (${url}): ${err?.message || err}. Skipping placeholder backfill.`
      );
      return { created: 0, existed: 0, scanned: 0 };
    }
  }

  let created = 0;
  let existed = 0;
  let scanned = 0;

  for (const collection of PHOTO_COLLECTIONS) {
    let page = 1;
    try {
      while (true) {
        const res = await pb.collection(collection).getList(page, 100, {
          fields: "id,title,name,label,display_name",
        });
        for (const rec of res.items) {
          scanned += 1;
          const slot = catalogSlot(rec.id, 1);
          if (!slot) continue;
          const webPath = path.join(CATALOG_DIR, `${slot}.webp`);
          if (fs.existsSync(webPath)) {
            existed += 1;
            continue;
          }
          const svg = renderPlaceholderSvg(slot, recordTitle(rec));
          const png = await sharp(Buffer.from(svg)).png().toBuffer();
          await writeWebMobilePair(slot, png);
          created += 1;
          console.log(`  + placeholder ${slot}.webp (${collection})`);
        }
        if (page >= res.totalPages) break;
        page += 1;
      }
    } catch (err) {
      console.warn(`⚠ Skip collection ${collection}: ${err?.message || err}`);
    }
  }

  return { created, existed, scanned };
}

async function main() {
  console.log(`Catalog dir: ${CATALOG_DIR}`);
  const mobile = await ensureMobilePairs();
  console.log(
    `Mobile pairs: created ${mobile.created}, already had ${mobile.skipped}, web slots ${mobile.totalWeb}`
  );

  if (SKIP_PB) {
    console.log("Skipped PB placeholder backfill (--no-pb).");
    return;
  }

  const ph = await ensurePlaceholdersFromPb();
  console.log(
    `Placeholders: created ${ph.created}, already had ${ph.existed}, scanned ${ph.scanned}`
  );
  console.log("✓ catalog-ensure-media done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
