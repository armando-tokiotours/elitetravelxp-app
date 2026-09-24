/// <reference path="../pb_data/types.d.ts" />
/**
 * Exact Source of Truth schema for TOKIOTOURS.
 * Adds app_settings + new field names on existing collections.
 * Legacy fields are left in place; app reads new names with fallbacks.
 */
migrate((app) => {
  // ── app_settings ────────────────────────────────────────────────
  try {
    app.findCollectionByNameOrId("app_settings");
  } catch (_) {
    const settings = new Collection({
      type: "base",
      name: "app_settings",
      listRule: "",
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "key", type: "text", required: true, min: 1, max: 120 },
        { name: "value", type: "text", required: true, max: 500 },
        { name: "description", type: "text", required: false, max: 1000 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_app_settings_key ON app_settings (`key`)",
      ],
    });
    app.save(settings);
  }

  const addIfMissing = (colName, fieldDef) => {
    const col = app.findCollectionByNameOrId(colName);
    try {
      col.fields.getByName(fieldDef.name);
    } catch (_) {
      col.fields.add(new Field(fieldDef));
      app.save(col);
    }
  };

  // ── cities ──────────────────────────────────────────────────────
  addIfMissing("cities", {
    name: "description",
    type: "text",
    required: false,
    max: 2000,
  });
  addIfMissing("cities", {
    name: "cover_photo",
    type: "file",
    maxSelect: 1,
    maxSize: 5242880,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  });
  addIfMissing("cities", {
    name: "is_active",
    type: "bool",
  });
  addIfMissing("cities", {
    name: "sort_order",
    type: "number",
    min: 0,
  });

  // ── tours ───────────────────────────────────────────────────────
  addIfMissing("tours", {
    name: "description",
    type: "text",
    required: false,
    max: 4000,
  });
  addIfMissing("tours", {
    name: "cover_photo",
    type: "file",
    maxSelect: 1,
    maxSize: 5242880,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  });
  addIfMissing("tours", {
    name: "price_per_person",
    type: "number",
    min: 0,
  });
  addIfMissing("tours", {
    name: "duration_hours",
    type: "number",
    min: 0,
  });
  addIfMissing("tours", {
    name: "is_active",
    type: "bool",
  });

  // ── vehicles ────────────────────────────────────────────────────
  addIfMissing("vehicles", {
    name: "name",
    type: "text",
    required: false,
    max: 120,
  });
  addIfMissing("vehicles", {
    name: "max_luggage",
    type: "number",
    min: 0,
  });
  addIfMissing("vehicles", {
    name: "vehicle_image",
    type: "file",
    maxSelect: 1,
    maxSize: 5242880,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  });

  // ── transfers ───────────────────────────────────────────────────
  addIfMissing("transfers", {
    name: "location_name",
    type: "text",
    required: false,
    max: 200,
  });
  addIfMissing("transfers", {
    name: "type",
    type: "select",
    maxSelect: 1,
    values: ["Arrival", "Departure", "Both"],
  });
  addIfMissing("transfers", {
    name: "base_pickup_fee",
    type: "number",
    min: 0,
  });
  addIfMissing("transfers", {
    name: "base_dropoff_fee",
    type: "number",
    min: 0,
  });

  // ── accommodations ──────────────────────────────────────────────
  addIfMissing("accommodations", {
    name: "min_price_per_night",
    type: "number",
    min: 0,
  });
  addIfMissing("accommodations", {
    name: "max_price_per_night",
    type: "number",
    min: 0,
  });
  addIfMissing("accommodations", {
    name: "max_occupancy",
    type: "number",
    min: 1,
  });
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("app_settings"));
  } catch (_) {}
});
