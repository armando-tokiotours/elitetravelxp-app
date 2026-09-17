/// <reference path="../pb_data/types.d.ts" />
/**
 * Saved trip quotations keyed by airline-style PNR (booking_ref) + email.
 * Guests may create/list/view (PNR + email act as the lookup credential);
 * only authenticated team may update/delete.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("quotations");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "quotations",
    listRule: "",
    viewRule: "",
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
        name: "payload",
        type: "json",
        required: true,
      },
      {
        name: "status",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["draft", "sent", "locked", "cancelled"],
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_quotations_booking_ref ON quotations (`booking_ref`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("quotations"));
  } catch (_) {
    /* ignore */
  }
});
