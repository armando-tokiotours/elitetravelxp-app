/// <reference path="../pb_data/types.d.ts" />
/**
 * Restore PocketBase autodate fields on bookings_and_leads.
 * Without `created`/`updated`, `sort=-created` returns 400
 * ("Something went wrong…") and Admin falls back to localStorage.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");

  if (!col.fields.getByName("created")) {
    col.fields.add(
      new Field({
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      })
    );
  }

  if (!col.fields.getByName("updated")) {
    col.fields.add(
      new Field({
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      })
    );
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings_and_leads");
    const created = col.fields.getByName("created");
    if (created) col.fields.removeById(created.id);
    const updated = col.fields.getByName("updated");
    if (updated) col.fields.removeById(updated.id);
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
