/// <reference path="../pb_data/types.d.ts" />
/**
 * Meeting point fields on bookings_and_leads (Builder S Geoapify).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");
  const names = new Set(col.fields.map((f) => f.name));

  if (!names.has("meeting_point_name")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "meeting_point_name",
        required: false,
        max: 240,
      })
    );
  }
  if (!names.has("meeting_point_address")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "meeting_point_address",
        required: false,
        max: 500,
      })
    );
  }
  if (!names.has("meeting_point_lat")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "meeting_point_lat",
        required: false,
      })
    );
  }
  if (!names.has("meeting_point_lng")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "meeting_point_lng",
        required: false,
      })
    );
  }
  if (!names.has("meeting_point_place_id")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "meeting_point_place_id",
        required: false,
        max: 256,
      })
    );
  }

  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");
  for (const name of [
    "meeting_point_name",
    "meeting_point_address",
    "meeting_point_lat",
    "meeting_point_lng",
    "meeting_point_place_id",
  ]) {
    const f = col.fields.getByName(name);
    if (f) col.fields.removeById(f.id);
  }
  app.save(col);
});
