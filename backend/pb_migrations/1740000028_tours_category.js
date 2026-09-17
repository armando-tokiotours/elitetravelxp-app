/// <reference path="../pb_data/types.d.ts" />
/** Tours: Tour vs Activity classification for Discover tabs. */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("category")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "category",
        required: false,
        maxSelect: 1,
        values: ["tour", "activity"],
      })
    );
    app.save(tours);
  }

  // Backfill legacy rows as guided tours
  const rows = app.findAllRecords(tours);
  for (const row of rows) {
    const cat = String(row.get("category") || "").trim();
    if (!cat) {
      row.set("category", "tour");
      app.save(row);
    }
  }
}, (app) => {
  /* keep field on down */
});
