/// <reference path="../pb_data/types.d.ts" />
/**
 * Silo 3 pocket: ops_dispatch — guide/driver assign vs job board, keyed by PNR.
 * Backfills from ops_hub assigned_guide_* / assigned_driver_*.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ops_dispatch");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "ops_dispatch",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "guide_mode",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["unassigned", "direct", "open", "claimed"],
        },
        {
          name: "driver_mode",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["unassigned", "direct", "open", "claimed"],
        },
        { name: "assigned_guide_id", type: "text", required: false, max: 64 },
        { name: "assigned_guide", type: "text", required: false, max: 200 },
        { name: "assigned_driver_id", type: "text", required: false, max: 64 },
        { name: "assigned_driver", type: "text", required: false, max: 200 },
        { name: "guide_board_visible", type: "bool", required: false },
        { name: "driver_board_visible", type: "bool", required: false },
        { name: "claimed_at", type: "date", required: false },
        { name: "assigned_by_staff_id", type: "text", required: false, max: 64 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_ops_dispatch_pnr ON ops_dispatch (`pnr`)",
        "CREATE INDEX idx_ops_dispatch_guide ON ops_dispatch (`assigned_guide_id`)",
        "CREATE INDEX idx_ops_dispatch_driver ON ops_dispatch (`assigned_driver_id`)",
      ],
    });
    app.save(col);
  }

  // Backfill from ops_hub
  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }
  const dispatch = app.findCollectionByNameOrId("ops_dispatch");
  const rows = app.findRecordsByFilter(hub, "id != ''", "-created", 500, 0);
  for (const row of rows) {
    const pnr = String(row.get("pnr") || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    let existing = null;
    try {
      existing = app.findFirstRecordByFilter(
        dispatch,
        `pnr="${pnr.replace(/"/g, "")}"`
      );
    } catch (_) {
      existing = null;
    }
    const guideId = String(row.get("assigned_guide_id") || "").trim();
    const guideName = String(row.get("assigned_guide") || "").trim();
    const driverId = String(row.get("assigned_driver_id") || "").trim();
    const driverName = String(row.get("assigned_driver") || "").trim();
    const fields = {
      pnr,
      guide_mode: guideId ? "direct" : "unassigned",
      driver_mode: driverId ? "direct" : "unassigned",
      assigned_guide_id: guideId,
      assigned_guide: guideName,
      assigned_driver_id: driverId,
      assigned_driver: driverName,
      guide_board_visible: false,
      driver_board_visible: false,
    };
    if (existing) {
      for (const [k, v] of Object.entries(fields)) existing.set(k, v);
      app.save(existing);
    } else {
      const rec = new Record(dispatch);
      for (const [k, v] of Object.entries(fields)) rec.set(k, v);
      app.save(rec);
    }
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ops_dispatch"));
  } catch (_) {
    /* ignore */
  }
});
