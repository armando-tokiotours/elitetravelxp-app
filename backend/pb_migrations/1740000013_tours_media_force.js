/// <reference path="../pb_data/types.d.ts" />
/**
 * Add tours immersive media fields.
 * Note: getByName returns null/undefined when missing (does not always throw).
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      const f = tours.fields.getByName(name);
      return !f;
    } catch (_) {
      return true;
    }
  };

  if (missing("media_type")) {
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
  if (missing("media_file")) {
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
  if (missing("base_price")) {
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
}, (app) => {});
