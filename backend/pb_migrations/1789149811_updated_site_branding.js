/// <reference path="../pb_data/types.d.ts" />
/**
 * Idempotent typography fields (may already exist from 1740000006).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("site_branding");
  } catch (_) {
    return;
  }

  const ensure = (name, max) => {
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

  ensure("font_h1", 120);
  ensure("font_h2", 120);
  ensure("font_h3", 120);
  ensure("font_body", 120);
  ensure("google_fonts_import_url", 800);
  app.save(col);
}, (app) => {});
