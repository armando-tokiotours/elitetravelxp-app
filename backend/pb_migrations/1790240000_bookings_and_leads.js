/// <reference path="../pb_data/types.d.ts" />
/**
 * Lightweight bookings & leads — PNR + email keyed snapshots.
 * Stores IDs/selections only (no full city/hotel/tour blobs).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("bookings_and_leads");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "bookings_and_leads",
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
        name: "email",
        type: "email",
        required: true,
      },
      {
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["multi_day", "single_day"],
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["lead", "in_progress", "quoted", "confirmed", "cancelled"],
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
        name: "guests",
        type: "json",
        required: true,
      },
      {
        name: "duration_value",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "selections",
        type: "json",
        required: true,
      },
      {
        name: "dossier_pdf_url",
        type: "text",
        required: false,
        max: 2000,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_bal_booking_ref ON bookings_and_leads (`booking_ref`)",
      "CREATE INDEX idx_bal_email ON bookings_and_leads (`email`)",
      "CREATE INDEX idx_bal_type_status ON bookings_and_leads (`type`, `status`)",
    ],
  });
  // Open list/create/update so Admin + guest upsert paths never 403.
  // (Force-unlock also applied in 179029 if this collection already existed.)
  col.listRule = "";
  col.viewRule = "";
  col.createRule = "";
  col.updateRule = "";
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("bookings_and_leads"));
  } catch (_) {
    /* ignore */
  }
});
