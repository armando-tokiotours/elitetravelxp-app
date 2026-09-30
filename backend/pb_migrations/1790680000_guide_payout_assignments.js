/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_tour_rates + itinerary_guide_assignments — payout snapshots.
 */
migrate((app) => {
  let guidesId = "";
  let toursId = "";
  try {
    guidesId = app.findCollectionByNameOrId("guides").id;
    toursId = app.findCollectionByNameOrId("tours").id;
  } catch (_) {
    return;
  }

  try {
    app.findCollectionByNameOrId("guide_tour_rates");
  } catch (_) {
    const rates = new Collection({
      type: "base",
      name: "guide_tour_rates",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "guide",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: guidesId,
          cascadeDelete: false,
        },
        {
          name: "tour",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: toursId,
          cascadeDelete: true,
        },
        { name: "tour_title", type: "text", required: false, max: 300 },
        { name: "standard_fee_6h", type: "number", required: false, min: 0 },
        { name: "standard_fee_8h", type: "number", required: false, min: 0 },
        { name: "default_expenses", type: "number", required: false, min: 0 },
        {
          name: "currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["EUR", "JPY"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_guide_tour_rates_tour ON guide_tour_rates (`tour`)",
      ],
    });
    app.save(rates);
  }

  try {
    app.findCollectionByNameOrId("itinerary_guide_assignments");
  } catch (_) {
    const assignments = new Collection({
      type: "base",
      name: "itinerary_guide_assignments",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "assigned_guide",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: guidesId,
          cascadeDelete: false,
        },
        { name: "staff_id", type: "text", required: false, max: 64 },
        {
          name: "tour",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: toursId,
          cascadeDelete: false,
        },
        { name: "tour_date", type: "date", required: false },
        {
          name: "tour_duration_hours",
          type: "number",
          required: false,
          min: 0,
        },
        { name: "guest_count", type: "number", required: false, min: 0 },
        {
          name: "retail_price_client",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "fee_source",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "guide_card_default",
            "tour_standard",
            "manual_override",
          ],
        },
        {
          name: "guide_fee_amount",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "guide_expenses_amount",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "total_guide_payout",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "tokiotours_net_margin",
          type: "number",
          required: true,
        },
        {
          name: "currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["EUR", "JPY"],
        },
        {
          name: "payout_status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["pending_tour", "approved", "paid"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_iga_pnr ON itinerary_guide_assignments (`pnr`)",
        "CREATE INDEX idx_iga_guide ON itinerary_guide_assignments (`assigned_guide`)",
      ],
    });
    app.save(assignments);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("itinerary_guide_assignments"));
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId("guide_tour_rates"));
  } catch (_) {}
});
