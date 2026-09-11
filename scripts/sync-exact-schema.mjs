#!/usr/bin/env node
/**
 * Sync Exact Source of Truth schema + copy legacy field values.
 *
 * PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/sync-exact-schema.mjs
 */
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.PB_URL || "http://127.0.0.1:8090");

const DEFAULT_SETTINGS = [
  {
    key: "max_adults_per_room",
    value: "3",
    description: "Maximum adults allowed per hotel room when suggesting room counts.",
  },
  {
    key: "second_vehicle_guest_threshold",
    value: "3",
    description: "If guest count exceeds this, allocate a second vehicle / larger van.",
  },
  {
    key: "allow_tours_on_travel_days",
    value: "false",
    description: "When true, tours may be scheduled on inter-city travel days.",
  },
  {
    key: "pricing_multiplier",
    value: "1",
    description: "Global markup applied to the live quotation estimate.",
  },
  {
    key: "seasonal_markup_percentage",
    value: "0",
    description: "Extra seasonal markup percentage (e.g. 10 = +10%).",
  },
];

async function main() {
  await pb
    .collection("_superusers")
    .authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);

  // Ensure app_settings exists (migration may have created it)
  try {
    await pb.collection("app_settings").getList(1, 1);
  } catch {
    console.error("app_settings missing — restart PocketBase to apply migrations first.");
    process.exit(2);
  }

  // Seed / migrate settings from system_rules if present
  let legacyRules = [];
  try {
    legacyRules = await pb.collection("system_rules").getFullList();
  } catch {
    /* optional */
  }

  const existing = await pb.collection("app_settings").getFullList();
  const have = new Set(existing.map((r) => r.key));

  for (const r of legacyRules) {
    if (!have.has(r.key)) {
      await pb.collection("app_settings").create({
        key: r.key,
        value: String(r.value ?? ""),
        description: r.label || r.group || "",
      });
      have.add(r.key);
      console.log("migrated setting", r.key);
    }
  }

  for (const s of DEFAULT_SETTINGS) {
    if (!have.has(s.key)) {
      await pb.collection("app_settings").create(s);
      console.log("created setting", s.key);
    }
  }

  // Cities: is_active default true
  const cities = await pb.collection("cities").getFullList();
  for (const c of cities) {
    const patch = {};
    if (c.is_active === null || c.is_active === undefined) patch.is_active = true;
    if (!c.description) patch.description = `${c.name} — curated Japan destination.`;
    if (Object.keys(patch).length) {
      await pb.collection("cities").update(c.id, patch);
      console.log("city", c.name, patch);
    }
  }

  // Tours: copy price → price_per_person, set is_active
  const tours = await pb.collection("tours").getFullList();
  for (const t of tours) {
    const patch = {};
    if (t.price_per_person == null && t.price != null) {
      patch.price_per_person = t.price;
    }
    if (t.duration_hours == null) patch.duration_hours = 6;
    if (t.is_active === null || t.is_active === undefined) patch.is_active = true;
    if (!t.description) patch.description = t.title;
    if (Object.keys(patch).length) {
      await pb.collection("tours").update(t.id, patch);
      console.log("tour", t.title);
    }
  }

  // Vehicles
  const vehicles = await pb.collection("vehicles").getFullList();
  for (const v of vehicles) {
    const patch = {};
    if (!v.name && v.type) patch.name = v.type;
    if (v.max_luggage == null) {
      patch.max_luggage = v.max_passengers >= 8 ? 8 : 3;
    }
    if (Object.keys(patch).length) {
      await pb.collection("vehicles").update(v.id, patch);
      console.log("vehicle", patch.name || v.name);
    }
  }

  // Transfers
  const transfers = await pb.collection("transfers").getFullList();
  for (const t of transfers) {
    const patch = {};
    if (!t.location_name && t.location) patch.location_name = t.location;
    if (t.base_pickup_fee == null && t.pickup_fee != null) {
      patch.base_pickup_fee = t.pickup_fee;
    }
    if (t.base_dropoff_fee == null && t.dropoff_fee != null) {
      patch.base_dropoff_fee = t.dropoff_fee;
    }
    if (!t.type) patch.type = "Both";
    if (Object.keys(patch).length) {
      await pb.collection("transfers").update(t.id, patch);
      console.log("transfer", patch.location_name || t.location_name);
    }
  }

  // Accommodations
  const hotels = await pb.collection("accommodations").getFullList();
  for (const h of hotels) {
    const patch = {};
    if (h.min_price_per_night == null && h.min_price != null) {
      patch.min_price_per_night = h.min_price;
    }
    if (h.max_price_per_night == null && h.max_price != null) {
      patch.max_price_per_night = h.max_price;
    }
    if (h.max_occupancy == null) patch.max_occupancy = 2;
    if (Object.keys(patch).length) {
      await pb.collection("accommodations").update(h.id, patch);
      console.log("hotel", h.tier, h.room_type);
    }
  }

  console.log("✓ Exact schema data sync complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
