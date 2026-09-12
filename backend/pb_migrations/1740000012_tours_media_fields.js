/// <reference path="../pb_data/types.d.ts" />
/**
 * Ensure tours media fields exist (retry if earlier migration no-oped).
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const has = (name) => {
    try {
      tours.fields.getByName(name);
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!has("media_type")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "media_type",
        required: false,
        maxSelect: 1,
        values: ["Image", "Video"],
      })
    );
  }
  if (!has("media_file")) {
    tours.fields.add(
      new Field({
        type: "file",
        name: "media_file",
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
        ],
      })
    );
  }
  if (!has("base_price")) {
    tours.fields.add(
      new Field({
        type: "number",
        name: "base_price",
        required: false,
        min: 0,
      })
    );
  }

  app.save(tours);
}, (app) => {
  /* keep fields on down — safe additive */
});
