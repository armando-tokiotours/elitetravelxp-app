/// <reference path="../pb_data/types.d.ts" />
/**
 * Silo 3 pocket: ops_money — owner-only pay + guest deposit/refund, keyed by PNR.
 * Backfills pay fields from ops_hub.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ops_money");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "ops_money",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        { name: "guide_pay_jpy", type: "number", required: false, min: 0 },
        { name: "driver_pay_jpy", type: "number", required: false, min: 0 },
        { name: "ticket_cost_jpy", type: "number", required: false, min: 0 },
        { name: "tour_count", type: "number", required: false, min: 0 },
        {
          name: "guest_pay_status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "unpaid",
            "deposit_10",
            "deposit_30",
            "paid",
            "refunded",
            "partial_refund",
          ],
        },
        { name: "guest_paid_jpy", type: "number", required: false, min: 0 },
        { name: "guest_refund_jpy", type: "number", required: false, min: 0 },
        { name: "notes", type: "text", required: false, max: 5000 },
        { name: "assigned_guide", type: "text", required: false, max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_ops_money_pnr ON ops_money (`pnr`)",
      ],
    });
    app.save(col);
  }

  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }
  const money = app.findCollectionByNameOrId("ops_money");
  const rows = app.findRecordsByFilter(hub, "id != ''", "-created", 500, 0);
  for (const row of rows) {
    const pnr = String(row.get("pnr") || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    let existing = null;
    try {
      existing = app.findFirstRecordByFilter(
        money,
        `pnr="${pnr.replace(/"/g, "")}"`
      );
    } catch (_) {
      existing = null;
    }
    const fields = {
      pnr,
      guide_pay_jpy: Number(row.get("guide_pay_jpy") || 0),
      driver_pay_jpy: Number(row.get("driver_pay_jpy") || 0),
      ticket_cost_jpy: Number(row.get("ticket_cost_jpy") || 0),
      tour_count: Number(row.get("tour_count") || 0),
      guest_pay_status: "unpaid",
      guest_paid_jpy: 0,
      guest_refund_jpy: 0,
      assigned_guide: String(row.get("assigned_guide") || "").trim(),
      notes: "",
    };
    if (existing) {
      for (const [k, v] of Object.entries(fields)) {
        if (k === "guest_pay_status" && existing.get("guest_pay_status")) continue;
        existing.set(k, v);
      }
      app.save(existing);
    } else {
      const rec = new Record(money);
      for (const [k, v] of Object.entries(fields)) rec.set(k, v);
      app.save(rec);
    }
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ops_money"));
  } catch (_) {
    /* ignore */
  }
});
