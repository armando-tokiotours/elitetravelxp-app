/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-register PocketBase thumb sizes (retry — 0035 may have no-op'd).
 * Without thumbs on the file field, ?thumb= returns the original full file.
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

  const patch = (collectionName, fieldNames) => {
    const collection = app.findCollectionByNameOrId(collectionName);
    let dirty = false;
    for (const fieldName of fieldNames) {
      let field;
      try {
        field = collection.fields.getByName(fieldName);
      } catch (_) {
        continue;
      }
      if (!field) continue;
      try {
        field.thumbs = THUMBS;
        dirty = true;
      } catch (e) {
        console.log("thumb assign failed", collectionName, fieldName, e);
      }
    }
    if (dirty) {
      app.save(collection);
      console.log("saved thumbs for", collectionName);
    }
  };

  patch("cities", ["cover_photo", "image"]);
  patch("tours", ["cover_photo", "image", "media_file"]);
  try {
    patch("seasonal_highlights", ["cover_photo"]);
  } catch (_) {}
  try {
    patch("feature_explainers", ["thumbnail_image", "media_file"]);
  } catch (_) {}
  try {
    patch("site_branding", ["logo_image", "hero_image"]);
  } catch (_) {}
}, (app) => {
  /* keep */
});
