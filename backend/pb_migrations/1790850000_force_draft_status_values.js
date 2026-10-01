/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-add `draft` to ops_hub / agency_orders / bookings_and_leads status.
 * Plain `status.values = [...]` can no-op on PB field proxies (see 1790350001).
 */
migrate((app) => {
  const ensureSelectValues = (colName, required) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      const status = col.fields.getByName("status");
      if (!status || status.type !== "select") return;

      const current = Array.isArray(status.values) ? [...status.values] : [];
      let changed = false;
      for (const v of required) {
        if (!current.includes(v)) {
          current.push(v);
          changed = true;
        }
      }
      // Prefer canonical order when replacing
      const ordered = required.filter((v) => current.includes(v));
      for (const v of current) {
        if (!ordered.includes(v)) ordered.push(v);
      }
      if (changed || ordered.join("|") !== current.join("|")) {
        status.values = [...ordered];
        app.save(col);
      }
    } catch (_) {
      /* collection missing */
    }
  };

  ensureSelectValues("ops_hub", [
    "draft",
    "incoming",
    "quoted",
    "confirmed",
    "in_ops",
    "done",
    "cancelled",
  ]);
  ensureSelectValues("agency_orders", [
    "draft",
    "incoming",
    "quoted",
    "confirmed",
    "in_ops",
    "done",
    "cancelled",
  ]);
  ensureSelectValues("bookings_and_leads", [
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
    /* best-effort */
  }
}, (app) => {
  void app;
});
