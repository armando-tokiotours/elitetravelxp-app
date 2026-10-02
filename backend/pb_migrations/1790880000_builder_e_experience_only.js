/// <reference path="../pb_data/types.d.ts" />
/**
 * Builder E — experience_only lead type on bookings_and_leads.
 */
migrate((app) => {
  try {
    const bal = app.findCollectionByNameOrId("bookings_and_leads");
    const type = bal.fields.getByName("type");
    if (!type || type.type !== "select") return;
    const values = Array.isArray(type.values) ? [...type.values] : [];
    if (!values.includes("experience_only")) {
      values.push("experience_only");
      type.values = values;
      app.save(bal);
    }
  } catch (_) {}
}, (app) => {
  void app;
});
