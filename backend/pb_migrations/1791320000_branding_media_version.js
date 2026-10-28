/// <reference path="../pb_data/types.d.ts" />
/**
 * branding_ui_items.media_version — version stamp for stable branding
 * slots (/uploads/branding/{slot}.webp). Slot URLs never change, so
 * guests/admin append ?v=<stamp> after an in-place replace.
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    if (!col.fields.getByName("media_version")) {
      col.fields.add(
        new Field({
          type: "text",
          name: "media_version",
          required: false,
          max: 64,
        })
      );
      app.save(col);
      console.log("[1791320000] branding_ui_items.media_version ready");
    }
  } catch (e) {
    console.log("[1791320000] branding_ui_items.media_version:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    try {
      col.fields.removeByName("media_version");
    } catch (_) {
      /* ignore */
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
