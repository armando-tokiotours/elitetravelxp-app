/// <reference path="../pb_data/types.d.ts" />
/**
 * Split Ticket (pre-purchase) vs Admission (on-site) on tours.access_type.
 * Keeps legacy direct_ticket; adds admission.
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const field = tours.fields.getByName("access_type");
  if (!field) return;
  const vals = Array.isArray(field.values) ? [...field.values] : [];
  const next = [
    "guided_route",
    "direct_ticket",
    "admission",
    "vip_event",
    "time_sensitive",
  ];
  let dirty = false;
  for (const v of next) {
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
  const field = tours.fields.getByName("access_type");
  if (!field) return;
  field.values = [
    "guided_route",
    "direct_ticket",
    "vip_event",
    "time_sensitive",
  ];
  app.save(tours);
});
