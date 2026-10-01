/// <reference path="../pb_data/types.d.ts" />
/**
 * Guest public-transit pass questionnaire on bookings_and_leads.
 * Also mirrored inside selections JSON for Tours / Ticketer.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");
  const addBool = (name) => {
    if (!col.fields.getByName(name)) {
      col.fields.add(
        new Field({
          type: "bool",
          name,
          required: false,
        })
      );
    }
  };
  addBool("guest_has_jr_pass");
  addBool("guest_has_ic_card");
  addBool("guest_needs_transit_help");
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings_and_leads");
    for (const name of [
      "guest_has_jr_pass",
      "guest_has_ic_card",
      "guest_needs_transit_help",
    ]) {
      if (col.fields.getByName(name)) {
        col.fields.removeByName(name);
      }
    }
    app.save(col);
  } catch (_) {}
});
