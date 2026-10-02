/// <reference path="../pb_data/types.d.ts" />
/**
 * Builder E attractions hero — site_branding widget copy + background.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");
  const addText = (name, max) => {
    if (col.fields.getByName(name)) return;
    col.fields.add(
      new Field({
        type: "text",
        name,
        required: false,
        max: max || 500,
      })
    );
  };
  addText("attractions_widget_title", 200);
  addText("attractions_widget_subtitle", 500);
  if (!col.fields.getByName("attractions_widget_bg")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "attractions_widget_bg",
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
  }
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const name of [
      "attractions_widget_title",
      "attractions_widget_subtitle",
      "attractions_widget_bg",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {}
});
