/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_pay_rules — yearly guide pay matrix (tour × hours × pax).
 * Source of Truth for CSV import/export in Team Access.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("guide_pay_rules");
    console.log("[1791120000] guide_pay_rules already exists");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "guide_pay_rules",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "year", type: "number", required: true, min: 2000 },
      { name: "tour_name", type: "text", required: true, max: 300 },
      { name: "duration_hours", type: "number", required: true, min: 0 },
      { name: "pax_count", type: "number", required: true, min: 1 },
      { name: "guide_pay_jpy", type: "number", required: true, min: 0 },
      { name: "expenses_jpy", type: "number", required: false, min: 0 },
      { name: "is_meet_and_greet", type: "bool", required: false },
      { name: "notes", type: "text", required: false, max: 500 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_guide_pay_rules_year ON guide_pay_rules (`year`)",
      "CREATE INDEX idx_guide_pay_rules_tour ON guide_pay_rules (`tour_name`)",
      "CREATE INDEX idx_guide_pay_rules_lookup ON guide_pay_rules (`year`, `tour_name`, `duration_hours`, `pax_count`)",
    ],
  });
  app.save(col);
  console.log("[1791120000] guide_pay_rules created");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("guide_pay_rules"));
  } catch (_) {
    /* ignore */
  }
});
