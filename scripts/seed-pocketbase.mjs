#!/usr/bin/env node
/**
 * Seeds PocketBase with Elite Travel config "truth" data.
 * Requires PocketBase running and a superuser account.
 *
 * Usage:
 *   PB_URL=http://127.0.0.1:8090 \
 *   PB_ADMIN_EMAIL=admin@travelexperiencesgroup.com \
 *   PB_ADMIN_PASSWORD=changeme123 \
 *   node scripts/seed-pocketbase.mjs
 */
import PocketBase from "pocketbase";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const EMAIL = process.env.PB_ADMIN_EMAIL || "admin@travelexperiencesgroup.com";
const PASSWORD = process.env.PB_ADMIN_PASSWORD || "EliteTravelAdmin2026!";

const pb = new PocketBase(PB_URL);

async function auth() {
  await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
}

async function clearCollection(name) {
  try {
    const rows = await pb.collection(name).getFullList();
    for (const row of rows) {
      await pb.collection(name).delete(row.id);
    }
  } catch (e) {
    console.warn(`skip clear ${name}:`, e.message);
  }
}

/** Tiny SVG city placeholder → File for PocketBase upload */
function cityImageFile(name, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue},35%,78%)"/>
    <stop offset="100%" stop-color="hsl(${hue},40%,58%)"/>
  </linearGradient></defs>
  <rect width="320" height="240" fill="url(#g)"/>
  <circle cx="250" cy="50" r="28" fill="rgba(255,255,255,0.35)"/>
  <text x="24" y="200" font-family="Georgia,serif" font-size="28" fill="rgba(15,30,60,0.75)">${name}</text>
</svg>`;
  const tmp = join(__dirname, ".seed-tmp");
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
  const path = join(tmp, `${name.toLowerCase().replace(/\s+/g, "-")}.svg`);
  writeFileSync(path, svg);
  return path;
}

async function seed() {
  console.log(`→ Connecting to ${PB_URL}`);
  await auth();
  console.log("→ Authenticated as superuser");

  for (const c of [
    "tours",
    "cities",
    "accommodations",
    "vehicles",
    "transfers",
    "transit_modes",
  ]) {
    await clearCollection(c);
  }

  const cityDefs = [
    { name: "Tokyo", modifier: 1.15, hue: 210 },
    { name: "Kyoto", modifier: 1.1, hue: 340 },
    { name: "Osaka", modifier: 1.05, hue: 25 },
    { name: "Kawaguchiko", modifier: 1.0, hue: 200 },
    { name: "Hakone", modifier: 1.08, hue: 15 },
    { name: "Hiroshima", modifier: 0.95, hue: 160 },
    { name: "Kanazawa", modifier: 0.98, hue: 280 },
    { name: "Takayama", modifier: 0.92, hue: 90 },
    { name: "Nagasaki", modifier: 0.94, hue: 190 },
    { name: "Fukuoka", modifier: 0.96, hue: 230 },
  ];

  const cityIds = {};
  let order = 0;
  for (const c of cityDefs) {
    const form = new FormData();
    form.append("name", c.name);
    form.append("base_price_modifier", String(c.modifier));
    form.append("sort_order", String(order++));
    const imgPath = cityImageFile(c.name, c.hue);
    const blob = new Blob([await (await import("fs")).promises.readFile(imgPath)], {
      type: "image/svg+xml",
    });
    form.append("image", blob, `${c.name}.svg`);
    const record = await pb.collection("cities").create(form);
    cityIds[c.name] = record.id;
    console.log(`  city: ${c.name}`);
  }

  const accommodations = [
    { tier: "4-star", room_type: "King", min_price: 280, max_price: 420 },
    { tier: "4-star", room_type: "Twin", min_price: 260, max_price: 400 },
    { tier: "4-star", room_type: "Executive Suite", min_price: 450, max_price: 680 },
    { tier: "5-star", room_type: "King", min_price: 520, max_price: 820 },
    { tier: "5-star", room_type: "Twin", min_price: 490, max_price: 780 },
    { tier: "5-star", room_type: "Executive Suite", min_price: 980, max_price: 1600 },
  ];
  for (const a of accommodations) {
    await pb.collection("accommodations").create(a);
  }
  console.log(`  accommodations: ${accommodations.length}`);

  const vehicles = [
    { type: "Alphard", max_passengers: 3, price_per_day: 450 },
    { type: "HiAce", max_passengers: 8, price_per_day: 580 },
  ];
  for (const v of vehicles) {
    await pb.collection("vehicles").create(v);
  }
  console.log(`  vehicles: ${vehicles.length}`);

  const transfers = [
    { location: "Osaka Airport (KIX/ITM)", pickup_fee: 180, dropoff_fee: 180 },
    { location: "Narita Airport (NRT)", pickup_fee: 220, dropoff_fee: 220 },
    { location: "Haneda Airport (HND)", pickup_fee: 160, dropoff_fee: 160 },
    { location: "Cruise Terminal", pickup_fee: 200, dropoff_fee: 200 },
  ];
  for (const t of transfers) {
    await pb.collection("transfers").create(t);
  }
  console.log(`  transfers: ${transfers.length}`);

  const tourDefs = [
    ["Tokyo", "Imperial Palace & Ginza Private Tour", 580],
    ["Tokyo", "teamLab Borderless & Odaiba", 520],
    ["Kyoto", "Arashiyama & Golden Pavilion", 620],
    ["Kyoto", "Gion & Tea Ceremony", 480],
    ["Osaka", "Street Food & Castle Tour", 420],
    ["Kawaguchiko", "Mt. Fuji Lakeside Experience", 540],
    ["Hakone", "Ropeway, Onsen & Lake Ashi", 560],
    ["Hiroshima", "Peace Memorial & Miyajima", 600],
    ["Kanazawa", "Kenrokuen & Samurai District", 450],
    ["Takayama", "Old Town & Hida Folk Village", 400],
    ["Nagasaki", "History & Dejima Walk", 380],
    ["Fukuoka", "Yatai Food & Temples", 360],
  ];
  for (const [city, title, price] of tourDefs) {
    await pb.collection("tours").create({
      city_id: cityIds[city],
      title,
      price,
    });
  }
  console.log(`  tours: ${tourDefs.length}`);

  for (const mode of [
    { label: "Bullet Train (Shinkansen)", price_per_leg: 220 },
    { label: "Private Car / Chauffeur", price_per_leg: 520 },
    { label: "Domestic Flight", price_per_leg: 280 },
  ]) {
    await pb.collection("transit_modes").create(mode);
  }
  console.log("  transit_modes: 3");

  console.log("✓ Seed complete. Admin UI:", `${PB_URL}/_/`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
