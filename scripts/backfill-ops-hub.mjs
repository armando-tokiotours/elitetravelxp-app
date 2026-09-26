#!/usr/bin/env node
/**
 * One-shot backfill: create ops_hub rows for existing bookings_and_leads PNRs.
 *
 * Usage:
 *   node scripts/backfill-ops-hub.mjs
 *   # or with explicit env:
 *   PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... \
 *     node scripts/backfill-ops-hub.mjs
 *
 * Safe to re-run — skips PNRs that already have an ops_hub row.
 * Loads `.env.local` / `.env` from the repo root when present.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import PocketBase from "pocketbase";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || !String(process.env[key] || "").trim()) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const pb = new PocketBase(
  process.env.PB_URL ||
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    "http://127.0.0.1:8090"
);
pb.autoCancellation(false);

const email =
  process.env.PB_ADMIN_EMAIL || "admin@tokiotours-app.com";
const password =
  process.env.PB_ADMIN_PASSWORD || "EliteTravelAdmin2026!";

function mapStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "quoted") return "quoted";
  if (s === "confirmed") return "confirmed";
  if (s === "cancelled") return "cancelled";
  return "incoming";
}

function guestSummary(guests) {
  if (!guests || typeof guests !== "object") return "";
  const adults = Math.max(0, Number(guests.adults) || 0);
  const kids = Math.max(0, Number(guests.kids ?? guests.children) || 0);
  const parts = [];
  if (adults > 0) parts.push(`${adults} adult${adults === 1 ? "" : "s"}`);
  if (kids > 0) parts.push(`${kids} kid${kids === 1 ? "" : "s"}`);
  return parts.join(", ");
}

async function main() {
  await pb.collection("_superusers").authWithPassword(email, password);

  let leads = [];
  try {
    leads = await pb.collection("bookings_and_leads").getFullList({
      requestKey: null,
    });
  } catch (e) {
    console.error(
      "bookings_and_leads missing — ensure PocketBase migrations have run."
    );
    console.error(e.message || e);
    process.exit(2);
  }

  try {
    await pb.collection("ops_hub").getList(1, 1, { requestKey: null });
  } catch (e) {
    console.error(
      "ops_hub missing — restart PocketBase so 1790330002_ops_hub.js applies."
    );
    console.error(e.message || e);
    process.exit(2);
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of leads) {
    const pnr = String(row.booking_ref || "")
      .trim()
      .toUpperCase();
    if (!pnr) {
      skipped += 1;
      continue;
    }

    let existing = null;
    try {
      existing = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr.replace(/"/g, "")}"`, {
          requestKey: null,
        });
    } catch {
      existing = null;
    }

    if (existing) {
      skipped += 1;
      continue;
    }

    const fields = {
      pnr,
      source: "direct",
      detail_collection: "bookings_and_leads",
      detail_id: row.id,
      status: mapStatus(row.status),
      primary_city: String(row.primary_city || "").trim() || "Tokyo",
      guest_summary: guestSummary(row.guests),
    };
    const tourDate = row.tour_date
      ? String(row.tour_date).slice(0, 10)
      : "";
    if (tourDate) fields.tour_date = tourDate;

    try {
      await pb.collection("ops_hub").create(fields, { requestKey: null });
      created += 1;
      console.log("created ops_hub", pnr);
    } catch (e) {
      failed += 1;
      console.warn("failed", pnr, e.message || e);
    }
  }

  console.log(
    JSON.stringify({ total: leads.length, created, skipped, failed }, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
