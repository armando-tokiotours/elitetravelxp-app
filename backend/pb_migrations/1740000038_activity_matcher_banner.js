/// <reference path="../pb_data/types.d.ts" />
/**
 * Activity Matcher banner branding — CTA fields + seed record.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  // Allow matcher category on the select field
  const categoryField = col.fields.getByName("category");
  if (categoryField) {
    const values = categoryField.values || [];
    if (!values.includes("matcher")) {
      categoryField.values = [...values, "matcher"];
    }
  }

  if (!col.fields.getByName("cta_primary")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "cta_primary",
        required: false,
        max: 120,
      })
    );
  }
  if (!col.fields.getByName("cta_secondary")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "cta_secondary",
        required: false,
        max: 120,
      })
    );
  }

  app.save(col);

  // Seed Discover / Builder Activity Matcher banner if missing
  try {
    app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "activity_matcher_banner"'
    );
  } catch (_) {
    const record = new Record(col, {
      key: "activity_matcher_banner",
      category: "matcher",
      title: "Activity Matcher",
      subtitle:
        "Unsure what to pick? Take our 30-Second Activity Matcher",
      description: "",
      cta_primary: "Watch Your Activity Match Reel",
      cta_secondary: "Take 30-Sec Style Quiz",
      sort_order: 1,
    });
    app.save(record);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    try {
      const row = app.findFirstRecordByFilter(
        "branding_ui_items",
        'key = "activity_matcher_banner"'
      );
      app.delete(row);
    } catch (_) {}
    col.fields.removeByName("cta_primary");
    col.fields.removeByName("cta_secondary");
    app.save(col);
  } catch (_) {}
});
