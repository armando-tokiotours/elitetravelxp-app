#!/usr/bin/env node
/**
 * Ensures system_rules defaults + vehicle name backfill.
 * Usage: PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/ensure-rules.mjs
 */
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.PB_URL || "http://127.0.0.1:8090");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASSWORD;

const defaults = [
  {
    key: "max_adults_per_room",
    value: "3",
    label: "Max adults per room",
    group: "hotels",
  },
  {
    key: "second_vehicle_guest_threshold",
    value: "3",
    label: "Guests before a second vehicle is assigned",
    group: "vehicles",
  },
  {
    key: "allow_tours_on_travel_days",
    value: "false",
    label: "Allow tours on inter-city travel days",
    group: "transit",
  },
  {
    key: "pricing_multiplier",
    value: "1",
    label: "Global pricing multiplier",
    group: "pricing",
  },
  {
    key: "seasonal_multiplier",
    value: "1",
    label: "Seasonal pricing multiplier",
    group: "pricing",
  },
];

async function main() {
  await pb.collection("_superusers").authWithPassword(email, password);

  let existing = [];
  try {
    existing = await pb.collection("system_rules").getFullList();
  } catch (e) {
    console.error("system_rules collection missing — restart PocketBase with migrations mounted.");
    console.error(e.message);
    process.exit(2);
  }

  const have = new Set(existing.map((r) => r.key));
  for (const r of defaults) {
    if (!have.has(r.key)) {
      await pb.collection("system_rules").create(r);
      console.log("created rule", r.key);
    }
  }

  const vehicles = await pb.collection("vehicles").getFullList();
  for (const v of vehicles) {
    if (!v.name && v.type) {
      await pb.collection("vehicles").update(v.id, { name: v.type });
      console.log("named vehicle", v.type);
    }
  }

  const cities = await pb.collection("cities").getFullList();
  for (const c of cities) {
    const patch = {};
    if (c.base_price == null && c.base_price_modifier) {
      patch.base_price = Math.round(140 * Number(c.base_price_modifier));
    }
    if (!c.description) {
      patch.description = `${c.name} — curated Japan destination.`;
    }
    if (Object.keys(patch).length) {
      await pb.collection("cities").update(c.id, patch);
      console.log("patched city", c.name);
    }
  }

  console.log(
    "ok rules=",
    (await pb.collection("system_rules").getFullList()).length
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
