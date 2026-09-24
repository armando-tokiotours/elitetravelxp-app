/// <reference path="../pb_data/types.d.ts" />
/**
 * Experiences & Places catalog fields on `tours`:
 * - entry_type: experience | place
 * - google_location: { lat, lng, place_id, address }
 * duration_hours already exists on tours.
 *
 * Also creates lightweight `experiences_and_places` collection for
 * place-first records that can be managed separately (synced into app
 * alongside tours where entry_type=place).
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (col, name) => {
    try {
      return !col.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  let dirty = false;

  if (missing(tours, "entry_type")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "entry_type",
        required: false,
        maxSelect: 1,
        values: ["experience", "place"],
      })
    );
    dirty = true;
  }

  if (missing(tours, "google_location")) {
    tours.fields.add(
      new Field({
        type: "json",
        name: "google_location",
        required: false,
      })
    );
    dirty = true;
  }

  if (dirty) app.save(tours);

  // Backfill entry_type
  const rows = app.findAllRecords(tours);
  for (const row of rows) {
    const et = String(row.get("entry_type") || "").trim();
    if (!et) {
      row.set("entry_type", "experience");
      app.save(row);
    }
  }

  // Dedicated collection for place landmarks (optional parallel catalog)
  try {
    app.findCollectionByNameOrId("experiences_and_places");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "experiences_and_places",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        max: 200,
      },
      {
        name: "city_id",
        type: "text",
        required: false,
        max: 64,
      },
      {
        name: "city_name",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["experience", "place"],
      },
      {
        name: "duration_hours",
        type: "number",
        required: false,
        min: 0,
        max: 24,
      },
      {
        name: "vibe_tags",
        type: "select",
        required: false,
        maxSelect: 4,
        values: ["culture", "foodie", "modern", "nature", "nightlife"],
      },
      {
        name: "description",
        type: "text",
        required: false,
        max: 5000,
      },
      {
        name: "google_location",
        type: "json",
        required: false,
      },
      {
        name: "cover_photo",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
      {
        name: "is_active",
        type: "bool",
        required: false,
      },
      {
        name: "sort_order",
        type: "number",
        required: false,
      },
    ],
    indexes: [
      "CREATE INDEX idx_eap_city ON experiences_and_places (`city_id`)",
      "CREATE INDEX idx_eap_type ON experiences_and_places (`type`)",
    ],
  });
  app.save(col);

  // Seed a few Tokyo landmark places when cities exist (idempotent by title)
  try {
    const cities = app.findAllRecords(app.findCollectionByNameOrId("cities"));
    let tokyoId = "";
    for (const c of cities) {
      if (String(c.get("name") || "").toLowerCase().includes("tokyo")) {
        tokyoId = c.id;
        break;
      }
    }
    const seeds = [
      {
        title: "Senso-ji Temple",
        duration_hours: 1.5,
        vibe_tags: ["culture"],
        address: "2 Chome-3-1 Asakusa, Taito City, Tokyo",
        lat: 35.7148,
        lng: 139.7967,
        place_id: "ChIJ8T1GpMGOGGAR3Kdnx4TPm4A",
      },
      {
        title: "Shibuya Crossing",
        duration_hours: 0.75,
        vibe_tags: ["modern"],
        address: "Shibuya, Tokyo",
        lat: 35.6595,
        lng: 139.7004,
        place_id: "ChIJAVkDPzdOGGAR09PiskAYr28",
      },
      {
        title: "Meiji Jingu",
        duration_hours: 1.25,
        vibe_tags: ["culture", "nature"],
        address: "1-1 Yoyogikamizonocho, Shibuya, Tokyo",
        lat: 35.6764,
        lng: 139.6993,
        place_id: "ChIJ5SZUm9iLGGARaju2kIu2a1U",
      },
    ];
    const existing = app.findAllRecords(col);
    const titles = {};
    for (const r of existing) titles[String(r.get("title") || "")] = true;
    for (const s of seeds) {
      if (titles[s.title]) continue;
      const rec = new Record(col);
      rec.set("title", s.title);
      rec.set("city_id", tokyoId);
      rec.set("city_name", "Tokyo");
      rec.set("type", "place");
      rec.set("duration_hours", s.duration_hours);
      rec.set("vibe_tags", s.vibe_tags);
      rec.set("description", `${s.title} — landmark stop for a single-day Tokyo itinerary.`);
      rec.set("google_location", {
        lat: s.lat,
        lng: s.lng,
        place_id: s.place_id,
        address: s.address,
      });
      rec.set("is_active", true);
      rec.set("sort_order", 10);
      app.save(rec);
    }
  } catch (_) {
    /* cities may not exist yet */
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("experiences_and_places"));
  } catch (_) {
    /* ignore */
  }
});
