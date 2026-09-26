/// <reference path="../pb_data/types.d.ts" />
/**
 * Silo 2 detail — agency portal orders (schema only; UI later).
 * Separate from bookings_and_leads so agency writes never overwrite builder rows.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("agency_orders");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "agency_orders",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "booking_ref",
        type: "text",
        required: true,
        max: 32,
      },
      {
        name: "agency_id",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "agency_name",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "contact_email",
        type: "email",
        required: false,
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
        name: "tour_date",
        type: "date",
        required: false,
      },
      {
        name: "primary_city",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "guests",
        type: "json",
        required: false,
      },
      {
        name: "notes",
        type: "text",
        required: false,
        max: 5000,
      },
      {
        name: "request_payload",
        type: "json",
        required: false,
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
      "CREATE UNIQUE INDEX idx_agency_orders_booking_ref ON agency_orders (`booking_ref`)",
      "CREATE INDEX idx_agency_orders_status ON agency_orders (`status`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("agency_orders"));
  } catch (_) {
    /* ignore */
  }
});
