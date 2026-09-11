#!/usr/bin/env node
/**
 * Seed PocketBase from Tokiotours_Trip_Builder_Menu_Data_2026.xlsx
 *
 * Usage:
 *   PB_URL=https://travelexperiencesgroup.com \
 *   PB_ADMIN_EMAIL=admin@travelexperiencesgroup.com \
 *   PB_ADMIN_PASSWORD='…' \
 *   npm run seed:excel
 *
 * Optional:
 *   EXCEL_PATH=/path/to/file.xlsx
 *   SEED_REPLACE=1   # clear cities/tours/vehicles/transfers/accommodations first
 */
import PocketBase from "pocketbase";
import XLSX from "xlsx";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;
const REPLACE = process.env.SEED_REPLACE === "1" || process.env.SEED_REPLACE === "true";

const DEFAULT_EXCEL = resolve(
  ROOT,
  "data/Tokiotours_Trip_Builder_Menu_Data_2026.xlsx"
);
const GDRIVE_EXCEL =
  "/Users/SIERRA/Library/CloudStorage/GoogleDrive-armando@tokiotours.nl/Shared drives/Company Profile/Tokiotours/Tokiotours_Trip_Builder_Menu_Data_2026.xlsx";

const EXCEL_PATH =
  process.env.EXCEL_PATH ||
  (existsSync(DEFAULT_EXCEL) ? DEFAULT_EXCEL : GDRIVE_EXCEL);

if (!EMAIL || !PASSWORD) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD");
  process.exit(1);
}
if (!existsSync(EXCEL_PATH)) {
  console.error("Excel file not found:", EXCEL_PATH);
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

function sheetRows(wb, sheetName, headerMatchers) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  let hi = -1;
  for (let i = 0; i < raw.length; i++) {
    const cells = (raw[i] || []).map((c) =>
      String(c ?? "")
        .replace(/\r\n/g, " ")
        .trim()
        .toLowerCase()
    );
    if (headerMatchers.every((m) => cells.some((c) => c.includes(m)))) {
      hi = i;
      break;
    }
  }
  if (hi < 0) throw new Error(`Header row not found in ${sheetName}`);

  const headers = (raw[hi] || []).map((c) =>
    String(c ?? "")
      .replace(/\r\n/g, " ")
      .trim()
  );

  const rows = [];
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i] || [];
    if (r.every((c) => c == null || c === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = r[idx];
    });
    const first = String(Object.values(obj)[0] ?? "");
    if (first === headers[0]) continue;
    rows.push(obj);
  }
  return rows;
}

function num(v) {
  if (v == null || v === "" || v === "—") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseHours(title) {
  const m = String(title).match(/(\d+)\s*h\b/i);
  return m ? Number(m[1]) : null;
}

function normalizeTier(star) {
  const s = String(star || "").toLowerCase();
  if (s.includes("5")) return "5-star";
  if (s.includes("4")) return "4-star";
  return null;
}

function vehicleCapacity(name) {
  const n = String(name).toLowerCase();
  if (n.includes("14")) return { max_passengers: 14, max_luggage: 10 };
  if (n.includes("10")) return { max_passengers: 10, max_luggage: 8 };
  if (n.includes("alphard")) return { max_passengers: 6, max_luggage: 3 };
  return { max_passengers: 4, max_luggage: 3 };
}

function median(nums) {
  const a = nums.filter((n) => n != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

/** Region / hub heuristics when Excel has no explicit price modifier. */
function cityModifier(name, region) {
  const n = String(name || "").toLowerCase();
  const r = String(region || "").toLowerCase();
  if (n.includes("tokyo")) return 1.15;
  if (n.includes("kyoto")) return 1.1;
  if (n.includes("osaka")) return 1.05;
  if (n.includes("hakone")) return 1.08;
  if (n.includes("fuji") || n.includes("kawaguchiko")) return 1.0;
  if (n.includes("hiroshima")) return 0.95;
  if (n.includes("kanazawa")) return 0.98;
  if (n.includes("takayama")) return 0.92;
  if (r.includes("kanto")) return 1.05;
  if (r.includes("kansai")) return 1.02;
  return 1.0;
}

function cityBasePrice(modifier) {
  return Math.round(140 * Number(modifier));
}

/**
 * Live PocketBase may still be on legacy field names (price, location, …)
 * while the app prefers exact names (price_per_person, location_name, …).
 * Probe once and write only fields that exist.
 */
let schemaFields = null;
async function loadSchemaFields() {
  if (schemaFields) return schemaFields;
  schemaFields = {};
  const cols = await pb.collections.getFullList();
  for (const c of cols) {
    schemaFields[c.name] = new Set(
      (c.fields || []).filter((f) => !f.system).map((f) => f.name)
    );
  }
  return schemaFields;
}

function pickFields(collection, payload) {
  const allowed = schemaFields?.[collection];
  if (!allowed) return payload;
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (allowed.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

async function clearCollection(name) {
  const rows = await pb.collection(name).getFullList();
  for (const row of rows) {
    await pb.collection(name).delete(row.id);
  }
  console.log(`  cleared ${name} (${rows.length})`);
}

function matchCityId(cityIds, area) {
  const a = String(area || "").trim().toLowerCase();
  if (!a) return null;
  // Exact / contains
  for (const [name, id] of Object.entries(cityIds)) {
    const n = name.toLowerCase();
    if (n === a || n.includes(a) || a.includes(n.split("(")[0].trim())) {
      return id;
    }
  }
  // Aliases
  const aliases = {
    fuji: "Kawaguchiko (Mt. Fuji)",
    "mt. fuji": "Kawaguchiko (Mt. Fuji)",
    kawaguchiko: "Kawaguchiko (Mt. Fuji)",
    kansai: "Osaka",
    "mount fuji": "Kawaguchiko (Mt. Fuji)",
  };
  for (const [key, city] of Object.entries(aliases)) {
    if (a.includes(key) && cityIds[city]) return cityIds[city];
  }
  return null;
}

async function main() {
  console.log("Excel:", EXCEL_PATH);
  console.log("PocketBase:", PB_URL);
  console.log("Replace existing data:", REPLACE);

  await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
  await loadSchemaFields();
  const wb = XLSX.readFile(EXCEL_PATH);

  const cityRows = sheetRows(wb, "Cities & Nights", ["city", "region"]);
  const airportRows = sheetRows(wb, "Airports & Meet-Assist", [
    "airport",
    "code",
  ]).filter((r) => r.Code && r.Code !== "—" && num(r["Base Price 2026 (€)"]) != null);
  const hotelRows = sheetRows(wb, "Hotels by City", ["city", "star"]).filter(
    (r) => normalizeTier(r["Star Rating"])
  );
  const tourRows = sheetRows(wb, "Tours - Tokiotours Pricing", [
    "area",
    "tour",
  ]).filter((r) => r.Area && r["Tour / Activity"]);
  const vehicleRows = sheetRows(wb, "Driver & Vehicle Prices", [
    "destination",
    "vehicle",
  ]).filter((r) => r.Vehicle && num(r["Client Price +40% (€, rounded to €5)"]) != null);
  const dayRateRows = sheetRows(wb, "Driver & Guide Day Rates", [
    "city",
    "driver",
  ]);

  if (REPLACE) {
    console.log("→ Clearing collections…");
    // tours first (relation), then cities
    for (const c of [
      "tours",
      "cities",
      "vehicles",
      "transfers",
      "accommodations",
    ]) {
      await clearCollection(c);
    }
  }

  // ── Cities ──────────────────────────────────────────────────────
  console.log("→ Seeding cities…");
  const cityIds = {};
  let sort = 0;
  for (const row of cityRows) {
    const name = String(row["City / Area"] || "").trim();
    if (!name) continue;
    const modifier = cityModifier(name, row.Region);
    const record = await pb.collection("cities").create(
      pickFields("cities", {
        name,
        description: String(row.Notes || row.Region || "").trim(),
        base_price_modifier: modifier,
        base_price: cityBasePrice(modifier),
        is_active: true,
        sort_order: sort++,
      })
    );
    cityIds[name] = record.id;
    console.log("  city:", name, `(×${modifier})`);
  }

  // Ensure hotel/tour cities exist even if missing from Cities sheet
  const extraNames = new Set([
    ...hotelRows.map((r) => String(r.City || "").trim()),
    ...tourRows.map((r) => String(r.Area || "").trim()),
  ]);
  for (const name of extraNames) {
    if (!name || cityIds[name] || matchCityId(cityIds, name)) continue;
    const modifier = cityModifier(name, "");
    const record = await pb.collection("cities").create(
      pickFields("cities", {
        name,
        description: `Imported from Excel (${name})`,
        base_price_modifier: modifier,
        base_price: cityBasePrice(modifier),
        is_active: true,
        sort_order: sort++,
      })
    );
    cityIds[name] = record.id;
    console.log("  city (extra):", name);
  }

  // ── Transfers ───────────────────────────────────────────────────
  console.log("→ Seeding transfers…");
  for (const row of airportRows) {
    const fee = num(row["Price +10% (€)"]) ?? num(row["Base Price 2026 (€)"]);
    const location_name = `${row.Airport} (${row.Code})`;
    await pb.collection("transfers").create(
      pickFields("transfers", {
        // exact schema
        location_name,
        type: "Both",
        base_pickup_fee: fee,
        base_dropoff_fee: fee,
        // legacy schema
        location: location_name,
        pickup_fee: fee,
        dropoff_fee: fee,
      })
    );
    console.log("  transfer:", location_name, fee);
  }

  // ── Accommodations ──────────────────────────────────────────────
  console.log("→ Seeding accommodations…");
  for (const row of hotelRows) {
    const tier = normalizeTier(row["Star Rating"]);
    if (!tier) continue;
    const city = String(row.City || "").trim();
    const min =
      num(row["Low Season Min (€)"]) ?? num(row["High Season Min (€)"]);
    const max =
      num(row["High Season Max (€)"]) ?? num(row["Low Season Max (€)"]);
    if (min == null || max == null) continue;
    await pb.collection("accommodations").create(
      pickFields("accommodations", {
        tier,
        room_type: `${city} Standard`,
        min_price_per_night: min,
        max_price_per_night: max,
        max_occupancy: 2,
        min_price: min,
        max_price: max,
      })
    );
    console.log(`  hotel: ${city} ${tier} €${min}–€${max}`);
  }

  // ── Vehicles ────────────────────────────────────────────────────
  console.log("→ Seeding vehicles…");
  const byType = new Map();
  for (const row of vehicleRows) {
    const name = String(row.Vehicle).trim();
    const price = num(row["Client Price +40% (€, rounded to €5)"]);
    if (!byType.has(name)) byType.set(name, []);
    byType.get(name).push(price);
  }
  for (const [name, prices] of byType) {
    const dayish = vehicleRows
      .filter(
        (r) =>
          String(r.Vehicle).trim() === name &&
          !/airport/i.test(String(r.Destination || ""))
      )
      .map((r) => num(r["Client Price +40% (€, rounded to €5)"]));
    const price_per_day =
      median(dayish.length ? dayish : prices) ??
      num(dayRateRows[0]?.["Driver (€)"]) ??
      450;
    const caps = vehicleCapacity(name);
    const displayName = name.includes("Alphard") ? "Toyota Alphard" : name;
    await pb.collection("vehicles").create(
      pickFields("vehicles", {
        name: displayName,
        type: displayName,
        ...caps,
        price_per_day,
      })
    );
    console.log(`  vehicle: ${displayName} day≈€${price_per_day}`, caps);
  }

  // ── Tours (unique Area + title; use 2-pax +10% / pax as per-person) ─
  console.log("→ Seeding tours…");
  const bestByKey = new Map();
  for (const row of tourRows) {
    const area = String(row.Area).trim();
    const title = String(row["Tour / Activity"]).trim();
    const key = `${area}||${title}`;
    const pax = Number(row.Pax) || 2;
    const pricePlus = num(row["Price +10% (€)"]) ?? num(row["Base Price 2026 (€)"]);
    if (pricePlus == null) continue;
    const existing = bestByKey.get(key);
    if (!existing || pax < existing.pax) {
      bestByKey.set(key, { area, title, pax, pricePlus, notes: row.Notes });
    }
  }

  let tourCount = 0;
  let skipped = 0;
  for (const t of bestByKey.values()) {
    const city_id = matchCityId(cityIds, t.area);
    if (!city_id) {
      console.warn("  skip tour (no city):", t.area, t.title);
      skipped++;
      continue;
    }
    const price_per_person =
      Math.round((t.pricePlus / Math.max(1, t.pax)) * 100) / 100;
    const duration_hours = parseHours(t.title) || 8;
    await pb.collection("tours").create(
      pickFields("tours", {
        city_id,
        title: t.title,
        description: [
          `Area: ${t.area}.`,
          `Package reference: €${t.pricePlus} for ${t.pax} pax (+10% list).`,
          t.notes ? String(t.notes) : "",
        ]
          .filter(Boolean)
          .join(" "),
        price_per_person,
        price: price_per_person,
        duration_hours,
        is_active: true,
      })
    );
    tourCount++;
    console.log(`  tour: [${t.area}] ${t.title} → €${price_per_person}/pp`);
  }

  console.log("\n✓ Seed complete");
  console.log(`  cities: ${Object.keys(cityIds).length}`);
  console.log(`  transfers: ${airportRows.length}`);
  console.log(`  accommodations: ${hotelRows.length}`);
  console.log(`  vehicles: ${byType.size}`);
  console.log(`  tours: ${tourCount} (skipped ${skipped})`);
  console.log("  Images left blank — upload via Team Access.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
