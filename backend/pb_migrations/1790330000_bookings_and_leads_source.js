/// <reference path="../pb_data/types.d.ts" />
/**
 * Tag Silo 1 detail rows with intake source.
 * Existing bookings_and_leads → source=direct.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");

  if (!col.fields.getByName("source")) {
    col.fields.add(
      new Field({
        type: "select",
        name: "source",
        required: false,
        maxSelect: 1,
        values: ["direct", "agency"],
      })
    );
    app.save(col);
  }

  try {
    const records = app.findAllRecords(col);
    for (const record of records) {
      const current = String(record.get("source") || "");
      if (!current) {
        record.set("source", "direct");
        app.save(record);
      }
    }
  } catch (_) {
    /* ignore record rewrite failures — schema still updated */
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings_and_leads");
    const f = col.fields.getByName("source");
    if (f) col.fields.removeById(f.id);
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
