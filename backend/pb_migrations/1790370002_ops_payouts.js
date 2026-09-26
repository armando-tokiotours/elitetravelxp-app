/// <reference path="../pb_data/types.d.ts" />
/**
 * ops_payouts — staff earnings per PNR (guide/driver visible; not guest money).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ops_payouts");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "ops_payouts",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "pnr", type: "text", required: true, max: 32 },
      { name: "staff_id", type: "text", required: true, max: 64 },
      { name: "staff_name", type: "text", required: false, max: 200 },
      {
        name: "role",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["guide", "driver"],
      },
      { name: "amount_jpy", type: "number", required: false, min: 0 },
      {
        name: "status",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["pending", "paid", "hold"],
      },
      { name: "notes", type: "text", required: false, max: 2000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_ops_payouts_pnr ON ops_payouts (`pnr`)",
      "CREATE INDEX idx_ops_payouts_staff ON ops_payouts (`staff_id`)",
      "CREATE UNIQUE INDEX idx_ops_payouts_unique ON ops_payouts (`pnr`, `staff_id`, `role`)",
    ],
  });
  app.save(col);

  // Seed from dispatch + money when possible
  try {
    const dispatch = app.findCollectionByNameOrId("ops_dispatch");
    const money = app.findCollectionByNameOrId("ops_money");
    const payouts = app.findCollectionByNameOrId("ops_payouts");
    const rows = app.findRecordsByFilter(dispatch, "id != ''", "", 500, 0);
    for (const d of rows) {
      const pnr = String(d.get("pnr") || "")
        .trim()
        .toUpperCase();
      if (!pnr) continue;
      let guidePay = 0;
      let driverPay = 0;
      try {
        const m = app.findFirstRecordByFilter(
          money,
          `pnr="${pnr.replace(/"/g, "")}"`
        );
        guidePay = Number(m.get("guide_pay_jpy") || 0);
        driverPay = Number(m.get("driver_pay_jpy") || 0);
      } catch (_) {
        /* no money row */
      }
      const guideId = String(d.get("assigned_guide_id") || "").trim();
      const driverId = String(d.get("assigned_driver_id") || "").trim();
      const upsert = (staffId, role, name, amount) => {
        if (!staffId) return;
        let existing = null;
        try {
          existing = app.findFirstRecordByFilter(
            payouts,
            `pnr="${pnr.replace(/"/g, "")}" && staff_id="${staffId.replace(/"/g, "")}" && role="${role}"`
          );
        } catch (_) {
          existing = null;
        }
        const fields = {
          pnr,
          staff_id: staffId,
          staff_name: name,
          role,
          amount_jpy: amount,
          status: "pending",
        };
        if (existing) {
          for (const [k, v] of Object.entries(fields)) existing.set(k, v);
          app.save(existing);
        } else {
          const rec = new Record(payouts);
          for (const [k, v] of Object.entries(fields)) rec.set(k, v);
          app.save(rec);
        }
      };
      upsert(
        guideId,
        "guide",
        String(d.get("assigned_guide") || "").trim(),
        guidePay
      );
      upsert(
        driverId,
        "driver",
        String(d.get("assigned_driver") || "").trim(),
        driverPay
      );
    }
  } catch (_) {
    /* optional backfill */
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ops_payouts"));
  } catch (_) {
    /* ignore */
  }
});
