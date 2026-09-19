/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-add Elite Concierge modal fields (poster + inclusion/credit copy)
 * and backfill the elite_concierge_modal seed row.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  const hasField = (name) => {
    try {
      return Boolean(col.fields.getByName(name));
    } catch (_) {
      return false;
    }
  };

  if (!hasField("poster")) {
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
  if (!hasField("inclusion_title")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "inclusion_title",
        required: false,
        max: 200,
      })
    );
  }
  if (!hasField("inclusion_body")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "inclusion_body",
        required: false,
        max: 8000,
      })
    );
  }
  if (!hasField("credit_title")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "credit_title",
        required: false,
        max: 200,
      })
    );
  }
  if (!hasField("credit_body")) {
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

  let row;
  try {
    row = app.findFirstRecordByFilter(
      "branding_ui_items",
      'key = "elite_concierge_modal"'
    );
  } catch (_) {
    row = new Record(col, {
      key: "elite_concierge_modal",
      category: "concierge",
      sort_order: 0,
    });
  }

  if (!row.get("title")) row.set("title", "Day-by-Day Design");
  if (!row.get("subtitle")) row.set("subtitle", "Design deposit €50");
  if (!row.get("inclusion_title")) row.set("inclusion_title", "What's included");
  if (!row.get("inclusion_body")) {
    row.set(
      "inclusion_body",
      "Skip individual planning. A dedicated luxury concierge curates your entire day-by-day itinerary: exclusive dining reservations, hidden sights, and private drivers for the full trip.\n\n• Full itinerary design by a Japan specialist\n• Hard-to-get reservations and private access\n• Private drivers coordinated across your route\n\nSelecting Elite Concierge replaces any individually chosen city experiences with the concierge design package."
    );
  }
  if (!row.get("credit_title")) {
    row.set("credit_title", "100% credit toward your trip");
  }
  if (!row.get("credit_body")) {
    row.set(
      "credit_body",
      "The €50 design deposit is fully applied as a credit toward your final trip balance when you confirm your booking. You are not paying an extra fee on top of your itinerary.\n\nThink of it as a commitment deposit that rolls into your invoice, not a sunk cost."
    );
  }
  app.save(row);
}, (app) => {
  /* keep fields on down — other seeds may use them */
});
