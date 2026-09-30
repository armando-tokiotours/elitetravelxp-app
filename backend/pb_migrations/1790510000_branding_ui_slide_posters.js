/// <reference path="../pb_data/types.d.ts" />
/**
 * Fast preload stills for Pre-Builder story videos.
 * media = slide 1 · poster = slide 2 · slide3 = slide 3
 * *_poster = optional still shown until video canplay.
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

  const addStill = (name) => {
    if (has(name)) return;
    col.fields.add(
      new Field({
        type: "file",
        name,
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        thumbs: ["100x100", "400x400", "600x400"],
      })
    );
  };

  addStill("media_poster");
  addStill("slide2_poster");
  addStill("slide3_poster");
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    for (const name of ["media_poster", "slide2_poster", "slide3_poster"]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
