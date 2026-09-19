/// <reference path="../pb_data/types.d.ts" />
/**
 * Elite Concierge modal branding — poster + inclusion/credit copy fields.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  if (!col.fields.getByName("poster")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "poster",
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["100x100", "400x400", "600x400"],
      })
    );
  }
  if (!col.fields.getByName("inclusion_title")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "inclusion_title",
        required: false,
        max: 200,
      })
    );
  }
  if (!col.fields.getByName("inclusion_body")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "inclusion_body",
        required: false,
        max: 8000,
      })
    );
  }
  if (!col.fields.getByName("credit_title")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "credit_title",
        required: false,
        max: 200,
      })
    );
  }
  if (!col.fields.getByName("credit_body")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "credit_body",
        required: false,
        max: 8000,
      })
    );
  }

  app.save(col);

  try {
    app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "elite_concierge_modal"'
    );
  } catch (_) {
    const record = new Record(col, {
      key: "elite_concierge_modal",
      category: "concierge",
      title: "Day-by-Day Design",
      subtitle: "Design deposit €50",
      description: "",
      inclusion_title: "What's included",
      inclusion_body:
        "Skip individual planning. A dedicated luxury concierge curates your entire day-by-day itinerary: exclusive dining reservations, hidden sights, and private drivers for the full trip.\n\n• Full itinerary design by a Japan specialist\n• Hard-to-get reservations and private access\n• Private drivers coordinated across your route\n\nSelecting Elite Concierge replaces any individually chosen city experiences with the concierge design package.",
      credit_title: "100% credit toward your trip",
      credit_body:
        "The €50 design deposit is fully applied as a credit toward your final trip balance when you confirm your booking. You are not paying an extra fee on top of your itinerary.\n\nThink of it as a commitment deposit that rolls into your invoice, not a sunk cost.",
      sort_order: 0,
    });
    app.save(record);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    try {
      const row = app.findFirstRecordByFilter(
        "branding_ui_items",
        'key = "elite_concierge_modal"'
      );
      app.delete(row);
    } catch (_) {}
    col.fields.removeByName("poster");
    col.fields.removeByName("inclusion_title");
    col.fields.removeByName("inclusion_body");
    col.fields.removeByName("credit_title");
    col.fields.removeByName("credit_body");
    app.save(col);
  } catch (_) {}
});
