/// <reference path="../pb_data/types.d.ts" />
/**
 * Multi-scene parallax hero — Site Branding → Main Intro.
 * Three scenes × four layered image files (bg / mid / fg / typography),
 * uploaded via the admin Hero Scenes grid and rendered by the homepage
 * as stacked 200vh sticky parallax scenes. All optional: empty scenes
 * simply don't render (Scene 1 falls back to the crafted SVG hero).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");

  const addFile = (name) => {
    try {
      if (col.fields.getByName(name)) return;
    } catch (_) {
      /* field missing — add it below */
    }
    col.fields.add(
      new Field({
        type: "file",
        name,
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
          "image/svg+xml",
        ],
      })
    );
  };

  for (const scene of [1, 2, 3]) {
    for (const layer of ["bg", "mid", "fg", "text"]) {
      addFile(`scene_${scene}_${layer}`);
    }
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const scene of [1, 2, 3]) {
      for (const layer of ["bg", "mid", "fg", "text"]) {
        const f = col.fields.getByName(`scene_${scene}_${layer}`);
        if (f) col.fields.removeById(f.id);
      }
    }
    app.save(col);
  } catch (_) {}
});
