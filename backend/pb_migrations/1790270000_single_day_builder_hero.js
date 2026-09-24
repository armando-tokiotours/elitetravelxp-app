/// <reference path="../pb_data/types.d.ts" />
/**
 * Builder S (Single-Day) hero branding card — Site Branding admin.
 * Key: single_day_builder_hero
 * Fields: title = script overlay, cta_primary = main title prefix, subtitle = tagline.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  const categoryField = col.fields.getByName("category");
  if (categoryField) {
    const values = categoryField.values || [];
    if (!values.includes("builder")) {
      categoryField.values = [...values, "builder"];
    }
  }

  app.save(col);

  try {
    app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "single_day_builder_hero"'
    );
  } catch (_) {
    const record = new Record(col, {
      key: "single_day_builder_hero",
      category: "builder",
      title: "Japan!",
      subtitle:
        "Curated 1-day immersive discovery across Japan's finest districts.",
      description: "",
      cta_primary: "YOUR DAY IN",
      cta_secondary: "",
      sort_order: 0,
    });
    app.save(record);
  }
}, (app) => {
  try {
    const row = app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "single_day_builder_hero"'
    );
    app.delete(row);
  } catch (_) {
    /* ignore */
  }
});
