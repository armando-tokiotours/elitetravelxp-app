/// <reference path="../pb_data/types.d.ts" />
/**
 * Typography fields on site_branding (H1 / H2 / Body + Google Fonts URL).
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
  ensureText("font_body", 120);
  ensureText("google_fonts_url", 800);

  app.save(col);

  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    if (!row.get("font_h1")) {
      row.set("font_h1", "Momo Trust Display");
      dirty = true;
    }
    if (!row.get("font_h2")) {
      row.set("font_h2", "Poppins");
      dirty = true;
    }
    if (!row.get("font_body")) {
      row.set("font_body", "Poppins");
      dirty = true;
    }
    // Migrate legacy URL field → google_fonts_url
    const legacy = String(row.get("google_fonts_import_url") || "");
    if (!row.get("google_fonts_url") && legacy) {
      row.set("google_fonts_url", legacy);
      dirty = true;
    }
    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of ["google_fonts_url"]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
