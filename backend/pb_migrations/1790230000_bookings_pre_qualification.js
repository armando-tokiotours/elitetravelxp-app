/// <reference path="../pb_data/types.d.ts" />
/**
 * Standalone pre-elite qualification leads.
 * Isolated from booking_requests so the trip builder flow is unchanged.
 * Guests create via the app API (admin); team may list and update.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("bookings");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "bookings",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "booking_ref",
        type: "text",
        required: true,
        max: 32,
      },
      {
        name: "full_name",
        type: "text",
        required: true,
        max: 200,
      },
      {
        name: "email",
        type: "email",
        required: true,
      },
      {
        name: "whatsapp",
        type: "text",
        required: false,
        max: 40,
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["pre_qualification"],
      },
      {
        name: "itinerary_data",
        type: "text",
        required: true,
        max: 8000,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_bookings_booking_ref ON bookings (`booking_ref`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("bookings"));
  } catch (_) {
    /* ignore */
  }
});
