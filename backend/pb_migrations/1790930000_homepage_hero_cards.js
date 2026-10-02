/// <reference path="../pb_data/types.d.ts" />
/**
 * Homepage linear poster cards — site_branding JSON config + cover photos.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");

  const addFile = (name) => {
    if (col.fields.getByName(name)) return;
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
        ],
      })
    );
  };

  const addText = (name, max) => {
    if (col.fields.getByName(name)) return;
    col.fields.add(
      new Field({
        type: "text",
        name,
        required: false,
        max: max || 0,
      })
    );
  };

  addText("hero_intro_config", 0);
  addFile("hero_card_single_photo");
  addFile("hero_card_experience_photo");
  addFile("hero_card_multiday_photo");

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of [
      "hero_intro_config",
      "hero_card_single_photo",
      "hero_card_experience_photo",
      "hero_card_multiday_photo",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {}
});
