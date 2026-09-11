/// <reference path="../pb_data/types.d.ts" />
/**
 * Add runtime typography fields to site_branding singleton.
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

  ensureText("font_h1", 120);
  ensureText("font_h2", 120);
  ensureText("font_h3", 120);
  ensureText("font_body", 120);
  ensureText("google_fonts_import_url", 800);

  app.save(col);

  // Seed defaults on existing singleton if empty
  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    if (!row.get("font_h1")) {
      row.set("font_h1", "Momo Trust Display");
      dirty = true;
    }
    if (!row.get("font_h2")) {
      row.set("font_h2", "Momo Trust Display");
      dirty = true;
    }
    if (!row.get("font_h3")) {
      row.set("font_h3", "Poppins");
      dirty = true;
    }
    if (!row.get("font_body")) {
      row.set("font_body", "Poppins");
      dirty = true;
    }
    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of [
      "font_h1",
      "font_h2",
      "font_h3",
      "font_body",
      "google_fonts_import_url",
    ]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
