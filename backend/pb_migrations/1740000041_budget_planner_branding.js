/// <reference path="../pb_data/types.d.ts" />
/**
 * Budget Planner page branding card (Site Branding admin).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  const categoryField = col.fields.getByName("category");
  if (categoryField) {
    const values = categoryField.values || [];
    if (!values.includes("planner")) {
      categoryField.values = [...values, "planner"];
    }
  }

  app.save(col);

  try {
    app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "budget_planner"'
    );
  } catch (_) {
    const record = new Record(col, {
      key: "budget_planner",
      category: "planner",
      title: "Travel Japan Your Way — Fits Any Budget",
      subtitle: "TAILORED PLANNING",
      description:
        "Have a tight or specific budget? Input your target limits and we will curate the best affordable sights, transit, and optional experiences for you.",
      cta_primary: "Open Budget Planner",
      cta_secondary: "Back to Builder",
      sort_order: 1,
      is_active: true,
    });
    app.save(record);
  }
}, (app) => {
  try {
    const row = app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "budget_planner"'
    );
    app.delete(row);
  } catch (_) {
    /* ignore */
  }
});
