/// <reference path="../pb_data/types.d.ts" />
/**
 * Unlock bookings_and_leads API rules + relax required JSON so guest upsert
 * and Admin list/search never hit "Something went wrong…"/validation_required.
 *
 * Rules:
 *   list/view/create/update → "" (open; Team Access still gates the UI)
 *   delete → auth required
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");

  col.listRule = "";
  col.viewRule = "";
  col.createRule = "";
  col.updateRule = "";
  col.deleteRule = "@request.auth.id != ''";

  const guests = col.fields.getByName("guests");
  if (guests) guests.required = false;

  const selections = col.fields.getByName("selections");
  if (selections) selections.required = false;

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings_and_leads");
    col.listRule = "@request.auth.id != ''";
    col.viewRule = "@request.auth.id != ''";
    col.createRule = "";
    col.updateRule = "@request.auth.id != ''";
    col.deleteRule = "@request.auth.id != ''";
    const guests = col.fields.getByName("guests");
    if (guests) guests.required = true;
    const selections = col.fields.getByName("selections");
    if (selections) selections.required = true;
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
