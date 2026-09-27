/// <reference path="../pb_data/types.d.ts" />
/**
 * Pre-Builder story slide 3 — file field on branding_ui_items.
 * media = slide 1 · poster = slide 2 · slide3 = slide 3 (image or video).
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

  if (!has("slide3")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "slide3",
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
    col.fields.removeByName("slide3");
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
