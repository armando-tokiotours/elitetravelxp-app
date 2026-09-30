/// <reference path="../pb_data/types.d.ts" />
/**
 * Canonical booking status + demand flags for Ops queues.
 * draft → incoming → quoted → confirmed → in_ops → done | cancelled
 */
migrate((app) => {
  const CANON = [
    "draft",
    "incoming",
    "quoted",
    "confirmed",
    "in_ops",
    "done",
    "cancelled",
  ];

  const forceStatusValues = (colName) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      const status = col.fields.getByName("status");
      if (!status || status.type !== "select") return;
      status.values = CANON;
      app.save(col);
    } catch (_) {
      /* collection missing */
    }
  };

  forceStatusValues("ops_hub");
  forceStatusValues("agency_orders");

  try {
    const bal = app.findCollectionByNameOrId("bookings_and_leads");
    const status = bal.fields.getByName("status");
    if (status && status.type === "select") {
      status.values = [
        "draft",
        "lead",
        "in_progress",
        "incoming",
        "quoted",
        "confirmed",
        "in_ops",
        "done",
        "cancelled",
      ];
      app.save(bal);
    }
  } catch (_) {
    /* ignore */
  }

  const addBool = (colName, fieldName) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      try {
        col.fields.getByName(fieldName);
      } catch (_) {
        col.fields.add(
          new Field({
            name: fieldName,
            type: "bool",
            required: false,
          })
        );
        app.save(col);
      }
    } catch (_) {
      /* ignore */
    }
  };

  addBool("ops_dispatch", "tickets_needed");
  addBool("ops_dispatch", "driver_needed");
  addBool("ops_dispatch", "guide_needed");
  addBool("ops_hub", "tickets_needed");
  addBool("ops_hub", "driver_needed");
  addBool("ops_hub", "guide_needed");
}, (app) => {
  /* non-destructive down */
  void app;
});
