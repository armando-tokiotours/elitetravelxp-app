/// <reference path="../pb_data/types.d.ts" />
/**
 * Lead lifecycle statuses on `bookings`:
 * draft → in_progress → confirmed (admin-only).
 * Migrates legacy `pre_qualification` → `draft`.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("bookings");
  } catch (_) {
    return;
  }

  const status = col.fields.getByName("status");
  if (!status || status.type !== "select") return;

  // Expand allowed values so we can rewrite existing rows.
  status.values = [
    "draft",
    "in_progress",
    "confirmed",
    "pre_qualification",
  ];
  status.required = true;
  status.maxSelect = 1;
  app.save(col);

  try {
    const records = app.findAllRecords(col);
    for (const record of records) {
      const current = String(record.get("status") || "");
      if (current === "pre_qualification" || !current) {
        record.set("status", "draft");
        app.save(record);
      }
    }
  } catch (_) {
    /* ignore record rewrite failures — schema still updated */
  }

  status.values = ["draft", "in_progress", "confirmed"];
  app.save(col);
}, (app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("bookings");
  } catch (_) {
    return;
  }
  const status = col.fields.getByName("status");
  if (!status || status.type !== "select") return;
  status.values = ["pre_qualification", "draft", "in_progress", "confirmed"];
  app.save(col);
});
