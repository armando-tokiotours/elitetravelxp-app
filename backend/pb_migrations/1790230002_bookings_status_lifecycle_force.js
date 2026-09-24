/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-fix bookings.status lifecycle values:
 * draft | in_progress | confirmed
 * Rewrites legacy pre_qualification → draft.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("bookings");
  } catch (_) {
    return;
  }

  const fields = col.fields;
  const status = fields.getByName("status");
  if (!status) return;

  // 1) Allow both legacy + new values so row rewrites succeed
  status.type = "select";
  status.required = true;
  status.maxSelect = 1;
  status.values = [
    "draft",
    "in_progress",
    "confirmed",
    "pre_qualification",
  ];
  app.save(col);

  // 2) Rewrite rows
  const rows = app.findAllRecords(col);
  for (const row of rows) {
    const cur = String(row.getString("status") || row.get("status") || "");
    if (cur === "pre_qualification" || cur === "" || !cur) {
      row.set("status", "draft");
      app.save(row);
    }
  }

  // 3) Lock to lifecycle values only
  const refreshed = app.findCollectionByNameOrId("bookings");
  const status2 = refreshed.fields.getByName("status");
  if (status2) {
    status2.values = ["draft", "in_progress", "confirmed"];
    status2.required = true;
    status2.maxSelect = 1;
    app.save(refreshed);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings");
    const status = col.fields.getByName("status");
    if (status) {
      status.values = [
        "pre_qualification",
        "draft",
        "in_progress",
        "confirmed",
      ];
      app.save(col);
    }
  } catch (_) {
    /* ignore */
  }
});
