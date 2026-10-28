/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_pay_settings — Super User defaults for expense allowance + specialty tiers.
 * Single-row convention (key = "default").
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("guide_pay_settings");
    console.log("[1791230000] guide_pay_settings already exists");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "guide_pay_settings",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "key", type: "text", required: true, max: 40 },
      {
        name: "default_expenses_jpy",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "specialty_tiers_json",
        type: "text",
        required: false,
        max: 4000,
      },
      { name: "notes", type: "text", required: false, max: 1000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_guide_pay_settings_key ON guide_pay_settings (`key`)",
    ],
  });
  app.save(col);

  try {
    const rec = new Record(col, {
      key: "default",
      default_expenses_jpy: 3000,
      specialty_tiers_json: JSON.stringify([
        { id: "level1", label: "Level 1 Specialty", amount_jpy: 3000 },
        { id: "level2", label: "Level 2 High Difficulty", amount_jpy: 5000 },
        { id: "vip", label: "VIP / Language Specialty", amount_jpy: 8000 },
      ]),
      notes: "Baseline expense allowance + specialty bonus presets for dispatch.",
    });
    app.save(rec);
  } catch (e) {
    console.log("[1791230000] seed default settings:", e);
  }

  console.log("[1791230000] guide_pay_settings created");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("guide_pay_settings"));
  } catch (_) {
    /* ignore */
  }
});
