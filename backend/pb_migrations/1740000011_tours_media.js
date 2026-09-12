/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours immersive media fields: media_type, media_file, base_price.
 * getByName returns null when missing (does not always throw).
 */
migrate((app) => {
  let tours;
  try {
    tours = app.findCollectionByNameOrId("tours");
  } catch (_) {
    return;
  }

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
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
}, (app) => {
  try {
    const tours = app.findCollectionByNameOrId("tours");
    for (const name of ["media_type", "media_file", "base_price"]) {
      try {
        const f = tours.fields.getByName(name);
        if (f) tours.fields.removeById(f.id);
      } catch (_) {}
    }
    app.save(tours);
  } catch (_) {}
});
