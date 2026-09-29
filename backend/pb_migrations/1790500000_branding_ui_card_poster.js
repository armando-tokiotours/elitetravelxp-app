/// <reference path="../pb_data/types.d.ts" />
/**
 * Still frame for Pre-Builder card video backgrounds (no-blink poster).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");
  const has = (name) => {
    try {
      return Boolean(col.fields.getByName(name));
    } catch (_) {
      return false;
    }
  };

  if (!has("card_poster")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "card_poster",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        thumbs: ["100x100", "400x400", "600x400"],
      })
    );
    app.save(col);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    col.fields.removeByName("card_poster");
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
