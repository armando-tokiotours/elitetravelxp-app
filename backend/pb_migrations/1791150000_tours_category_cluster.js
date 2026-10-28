/// <reference path="../pb_data/types.d.ts" />
/**
 * 3-tier catalog: Tour | Experience (activity) | Regional Cluster.
 * Clusters are neighborhood sectors (€0 item price, day time budget).
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const field = tours.fields.getByName("category");
  if (!field) return;
  const vals = Array.isArray(field.values) ? [...field.values] : [];
  let dirty = false;
  for (const v of ["tour", "activity", "cluster"]) {
    if (!vals.includes(v)) {
      vals.push(v);
      dirty = true;
    }
  }
  if (dirty) {
    field.values = vals;
    app.save(tours);
  }
}, (app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const field = tours.fields.getByName("category");
  if (!field) return;
  field.values = ["tour", "activity"];
  app.save(tours);
});
