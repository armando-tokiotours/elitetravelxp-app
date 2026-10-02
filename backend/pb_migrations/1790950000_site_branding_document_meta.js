/// <reference path="../pb_data/types.d.ts" />
/**
 * Browser tab title + meta description on site_branding (Team Brand Configuration).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");

  const ensureText = (name, max) => {
    try {
      col.fields.getByName(name);
    } catch (_) {
      col.fields.add(
        new Field({
          type: "text",
          name,
          required: false,
          max: max || 200,
        })
      );
    }
  };

  ensureText("document_title", 180);
  ensureText("document_description", 400);

  app.save(col);

  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    if (!row.get("document_title")) {
      row.set(
        "document_title",
        "TOKIOTOURS — Bespoke Luxury Japan Travel Builder"
      );
      dirty = true;
    }
    if (!row.get("document_description")) {
      row.set(
        "document_description",
        "Bespoke luxury Japan itineraries — design your journey with the live Trip Builder."
      );
      dirty = true;
    }
    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of ["document_title", "document_description"]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
