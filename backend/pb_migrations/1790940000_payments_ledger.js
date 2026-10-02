/// <reference path="../pb_data/types.d.ts" />
/**
 * Central payment ledger — every Revolut success writes one row here
 * so Ops can prove a payment executed (PNR, amount, order id, kind).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("payments");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "payments",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "kind",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "concierge_deposit",
            "tour_deposit",
            "tour_partial",
            "tour_full",
            "other",
          ],
        },
        { name: "amount_eur", type: "number", required: true },
        { name: "currency", type: "text", required: false, max: 8 },
        { name: "provider", type: "text", required: false, max: 32 },
        { name: "order_id", type: "text", required: false, max: 128 },
        { name: "path", type: "text", required: false, max: 32 },
        { name: "guest_email", type: "email", required: false },
        { name: "guest_name", type: "text", required: false, max: 200 },
        { name: "builder", type: "text", required: false, max: 32 },
        { name: "notes", type: "text", required: false, max: 2000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_payments_pnr ON payments (`pnr`)",
        "CREATE INDEX idx_payments_order ON payments (`order_id`)",
        "CREATE INDEX idx_payments_kind ON payments (`kind`)",
      ],
    });
    app.save(col);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("payments"));
  } catch (_) {}
});
