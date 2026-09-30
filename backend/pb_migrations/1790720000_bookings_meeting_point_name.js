/// <reference path="../pb_data/types.d.ts" />
/**
 * Ensure meeting_point_name exists (Geoapify hub title) if an older
 * meeting-point migration already ran without it.
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
    app.save(col);
  }
}, (app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");
  const f = col.fields.getByName("meeting_point_name");
  if (f) {
    col.fields.removeById(f.id);
    app.save(col);
  }
});
