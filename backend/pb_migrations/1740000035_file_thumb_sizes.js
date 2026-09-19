/// <reference path="../pb_data/types.d.ts" />
/**
 * Register PocketBase thumb sizes on cities + tours file fields.
 * Without these, ?thumb=WxH returns the ORIGINAL full-resolution file.
 */
migrate((app) => {
  const THUMBS = [
    "100x100",
    "120x120",
    "200x200",
    "300x300",
    "400x400",
    "600x400",
    "800x400",
    "800x1200",
    "1920x1080",
  ];

  const patchCollection = (name) => {
    const col = app.findCollectionByNameOrId(name);
    let dirty = false;
    for (const fieldName of ["cover_photo", "image", "media_file", "thumbnail_image"]) {
      try {
        const f = col.fields.getByName(fieldName);
        if (!f || f.type !== "file") continue;
        f.maxSelect = f.maxSelect || 1;
        f.thumbs = THUMBS;
        dirty = true;
      } catch (_) {
        /* field missing */
      }
    }
    if (dirty) app.save(col);
  };

  patchCollection("cities");
  patchCollection("tours");
  try {
    patchCollection("seasonal_highlights");
  } catch (_) {
    /* optional */
  }
  try {
    patchCollection("feature_explainers");
  } catch (_) {
    /* optional */
  }
  try {
    patchCollection("site_branding");
  } catch (_) {
    /* optional */
  }
}, (app) => {
  /* keep thumbs on down */
});
