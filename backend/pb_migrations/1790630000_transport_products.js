/// <reference path="../pb_data/types.d.ts" />
/**
 * Transport products catalog (Suica, Shinkansen, ferry, bike, ride…)
 * + ops_tickets.ticket_lines JSON so Ticketer sees line items like experiences.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("transport_products");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "transport_products",
      listRule: "",
      viewRule: "",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "name", type: "text", required: true, max: 200 },
        {
          name: "transport_type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "suica",
            "bullet_train",
            "local_rail",
            "ferry",
            "bike",
            "ride",
            "other",
          ],
        },
        { name: "description", type: "text", required: false, max: 5000 },
        { name: "price_per_person", type: "number", required: false },
        { name: "duration_hours", type: "number", required: false },
        { name: "total_hours_note", type: "text", required: false, max: 500 },
        { name: "explainer_url", type: "url", required: false },
        {
          name: "explainer_video",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 52428800,
          mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        },
        {
          name: "cover_photo",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        },
        { name: "city_id", type: "text", required: false, max: 64 },
        { name: "is_active", type: "bool", required: false },
        { name: "sort_order", type: "number", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_transport_products_type ON transport_products (`transport_type`)",
        "CREATE INDEX idx_transport_products_active ON transport_products (`is_active`)",
      ],
    });
    app.save(col);
  }

  // Line items on ops_tickets (JSON array of catalog picks)
  try {
    const tickets = app.findCollectionByNameOrId("ops_tickets");
    const has = tickets.fields.getByName("ticket_lines");
    if (!has) {
      tickets.fields.add(
        new Field({
          type: "json",
          name: "ticket_lines",
          required: false,
        })
      );
      app.save(tickets);
    }
  } catch (_) {}
}, (app) => {
  try {
    const tickets = app.findCollectionByNameOrId("ops_tickets");
    try {
      tickets.fields.removeByName("ticket_lines");
      app.save(tickets);
    } catch (_) {}
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId("transport_products"));
  } catch (_) {}
});
