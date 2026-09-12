/// <reference path="../pb_data/types.d.ts" />
/**
 * feature_explainers: add thumbnail_image for explainer trigger buttons.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("feature_explainers");
  } catch (_) {
    return;
  }

  try {
    if (col.fields.getByName("thumbnail_image")) return;
  } catch (_) {
    /* add below */
  }

  col.fields.add(
    new Field({
      type: "file",
      name: "thumbnail_image",
      required: false,
      maxSelect: 1,
      maxSize: 10485760,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    })
  );
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    const f = col.fields.getByName("thumbnail_image");
    if (f) {
      col.fields.removeById(f.id);
      app.save(col);
    }
  } catch (_) {}
});
