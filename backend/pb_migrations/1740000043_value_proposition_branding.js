/// <reference path="../pb_data/types.d.ts" />
/**
 * Core value proposition branding — TOKIOTOURS Difference.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  const categoryField = col.fields.getByName("category");
  if (categoryField) {
    const values = categoryField.values || [];
    if (!values.includes("value")) {
      categoryField.values = [...values, "value"];
    }
  }

  app.save(col);

  try {
    app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "value_proposition"'
    );
  } catch (_) {
    const record = new Record(col, {
      key: "value_proposition",
      category: "value",
      title: "The TOKIOTOURS Difference",
      subtitle: "Cultural Translation, Not Just Sightseeing",
      description:
        "Seamless Logistics: Zero language barriers, no local rule confusion, and VIP crowd navigation.\nCultural Translator: Move beyond Wikipedia facts—understand the deep history, unwritten etiquette, and hidden stories.\nTime & Comfort Optimization: Skip queues, avoid travel friction, and experience Japan at your preferred rhythm.",
      inclusion_title: "Why Book an Elite Specialist?",
      inclusion_body:
        "Logistics mastery, culture-to-culture translation, and exclusive access — so you experience Japan without friction, guesswork, or tourist-trap detours.",
      credit_title: "Self-Guided (Ticket Only): Photo opportunity & entry.",
      credit_body:
        "Elite Guided Experience: Full cultural translation, zero transit friction, and local etiquette masterclass.",
      cta_primary: "Explore Elite Experiences",
      cta_secondary: "Compare options",
      sort_order: 0,
      is_active: true,
    });
    app.save(record);
  }
}, (app) => {
  try {
    const row = app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "value_proposition"'
    );
    app.delete(row);
  } catch (_) {
    /* ignore */
  }
});
