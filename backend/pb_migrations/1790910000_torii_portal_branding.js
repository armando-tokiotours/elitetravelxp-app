/// <reference path="../pb_data/types.d.ts" />
/**
 * Homepage Torii portal carousel — site_branding frame/image/scale/orientation.
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
          "image/svg+xml",
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
        max: max || 64,
      })
    );
  };

  const addSelect = (name, values) => {
    if (col.fields.getByName(name)) return;
    col.fields.add(
      new Field({
        type: "select",
        name,
        required: false,
        maxSelect: 1,
        values,
      })
    );
  };

  addFile("torii_multiday_frame");
  addFile("torii_multiday_image");
  addFile("torii_single_frame");
  addFile("torii_single_image");
  addFile("torii_builder_e_frame");
  addFile("torii_builder_e_image");
  addText("torii_gate_scale", 16);
  addSelect("torii_orientation", ["HORIZONTAL", "VERTICAL"]);

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of [
      "torii_multiday_frame",
      "torii_multiday_image",
      "torii_single_frame",
      "torii_single_image",
      "torii_builder_e_frame",
      "torii_builder_e_image",
      "torii_gate_scale",
      "torii_orientation",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {}
});
