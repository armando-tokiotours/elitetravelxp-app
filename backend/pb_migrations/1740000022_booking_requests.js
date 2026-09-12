/// <reference path="../pb_data/types.d.ts" />
/**
 * Public booking / deposit requests from the trip builder summary page.
 * Guests may create; only authenticated team may list/update.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("booking_requests");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "booking_requests",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "reference",
        type: "text",
        required: true,
        max: 64,
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["pending_deposit", "paid", "cancelled", "contacted"],
      },
      {
        name: "guest_label",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "adults",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "children",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "arrival_date",
        type: "text",
        required: false,
        max: 32,
      },
      {
        name: "departure_date",
        type: "text",
        required: false,
        max: 32,
      },
      {
        name: "quote_min",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "quote_max",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "payload",
        type: "json",
        required: true,
      },
      {
        name: "contact_email",
        type: "email",
        required: false,
      },
      {
        name: "notes",
        type: "text",
        required: false,
        max: 2000,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_booking_requests_reference ON booking_requests (`reference`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("booking_requests"));
  } catch (_) {
    /* ignore */
  }
});
