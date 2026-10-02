/// <reference path="../pb_data/types.d.ts" />
/**
 * Builder E — force-add experience_only to bookings_and_leads.type
 * (179088 may have no-op'd if select values were not writable that run).
 */
migrate((app) => {
  const bal = app.findCollectionByNameOrId("bookings_and_leads");
  const type = bal.fields.getByName("type");
  if (!type) throw new Error("bookings_and_leads.type missing");
  const values = Array.isArray(type.values) ? type.values.slice() : [];
  if (!values.includes("experience_only")) {
    values.push("experience_only");
    type.values = values;
    app.save(bal);
  }
}, (app) => {
  try {
    const bal = app.findCollectionByNameOrId("bookings_and_leads");
    const type = bal.fields.getByName("type");
    if (type && Array.isArray(type.values)) {
      type.values = type.values.filter((v) => v !== "experience_only");
      app.save(bal);
    }
  } catch (_) {}
});
