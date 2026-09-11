/// <reference path="../pb_data/types.d.ts" />
/**
 * Idempotent google_fonts_url field (may already exist from 1740000007).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("site_branding");
  } catch (_) {
    return;
  }
  try {
    col.fields.getByName("google_fonts_url");
  } catch (_) {
    col.fields.add(
      new Field({
        type: "text",
        name: "google_fonts_url",
        required: false,
        max: 800,
      })
    );
    app.save(col);
  }
}, (app) => {});
