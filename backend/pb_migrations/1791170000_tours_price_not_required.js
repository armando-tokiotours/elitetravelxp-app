/// <reference path="../pb_data/types.d.ts" />
/**
 * Legacy `price` remains for old readers, but tiered pax fields are the source
 * of truth. Keep the field, stop hard-requiring it so empty creates don't lock.
 * App still syncs price ← price_1_pax on every write.
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const field = tours.fields.getByName("price");
  if (!field) return;
  if (field.required) {
    field.required = false;
    app.save(tours);
  }
}, (app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const field = tours.fields.getByName("price");
  if (!field) return;
  field.required = true;
  app.save(tours);
});
