/// <reference path="../pb_data/types.d.ts" />
/**
 * Ensure ops_hub + bookings_and_leads accept canonical DRAFT status.
 * Without `draft` on ops_hub, builder autosaves that map lead→draft fail
 * validation and never land under the Ops Draft tab.
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

  const forceValues = (colName, values) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      const status = col.fields.getByName("status");
      if (!status || status.type !== "select") return;
      status.values = values;
      app.save(col);
    } catch (_) {
      /* collection missing */
    }
  };

  forceValues("ops_hub", CANON);
  forceValues("agency_orders", CANON);

  forceValues("bookings_and_leads", [
    "draft",
    "lead",
    "in_progress",
    "incoming",
    "quoted",
    "confirmed",
    "in_ops",
    "done",
    "cancelled",
  ]);

  // Normalize legacy ops_hub aliases → canonical draft / incoming
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    const rows = app.findRecordsByFilter(
      hub,
      'status="lead" || status="in_progress" || status=""',
      "-created",
      500,
      0
    );
    for (const row of rows) {
      const raw = String(row.get("status") || "")
        .trim()
        .toLowerCase();
      const next =
        raw === "in_progress" || raw === "incoming" ? "incoming" : "draft";
      if (raw === next) continue;
      row.set("status", next);
      app.save(row);
    }
  } catch (_) {
    /* best-effort data normalize */
  }
}, (app) => {
  void app;
});
