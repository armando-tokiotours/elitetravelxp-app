/// <reference path="../pb_data/types.d.ts" />
/**
 * Silo 3 ops hub — one light row per PNR.
 * Pointer + ops fields only; full itinerary stays in Silo 1/2 detail collections.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ops_hub");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "ops_hub",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "pnr",
        type: "text",
        required: true,
        max: 32,
      },
      {
        name: "source",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["direct", "agency"],
      },
      {
        name: "detail_collection",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["bookings_and_leads", "agency_orders"],
      },
      {
        name: "detail_id",
        type: "text",
        required: true,
        max: 64,
      },
      {
        name: "status",
        type: "select",
        required: false,
        maxSelect: 1,
        values: [
          "incoming",
          "quoted",
          "confirmed",
          "in_ops",
          "done",
          "cancelled",
        ],
      },
      {
        name: "primary_city",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "tour_date",
        type: "date",
        required: false,
      },
      {
        name: "guest_summary",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "assigned_guide",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "assigned_driver",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "special_requests",
        type: "json",
        required: false,
      },
      {
        name: "extras",
        type: "json",
        required: false,
      },
      {
        name: "pickup_notes",
        type: "text",
        required: false,
        max: 2000,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_ops_hub_pnr ON ops_hub (`pnr`)",
      "CREATE INDEX idx_ops_hub_status ON ops_hub (`status`)",
      "CREATE INDEX idx_ops_hub_source ON ops_hub (`source`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ops_hub"));
  } catch (_) {
    /* ignore */
  }
});
