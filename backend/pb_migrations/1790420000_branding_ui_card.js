/// <reference path="../pb_data/types.d.ts" />
/**
 * Pre-Builder choice-card background — branding_ui_items.card
 * (image or video shown when that quiz option is selected).
 * Separate from story slides: media / poster / slide3.
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

  if (!has("card")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "card",
        required: false,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-m4v",
        ],
        thumbs: ["100x100", "400x400", "600x400"],
      })
    );
    app.save(col);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    col.fields.removeByName("card");
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
