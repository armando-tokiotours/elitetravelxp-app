/// <reference path="../pb_data/types.d.ts" />
/**
 * Site Branding → ICONS — generic `icon` file field on branding_ui_items.
 * One field for every keyed branding row (pre_elite_*, pace_*), not
 * per-key fields. SVG/PNG only, ≤100KB (64×64, 1:1 by spec).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");
  const has = (name) => {
    try {
      return Boolean(col.fields.getByName(name));
    } catch (_) {
      return false;
    }
  };

  if (!has("icon")) {
    col.fields.add(
      new Field({
        type: "file",
        name: "icon",
        required: false,
        maxSelect: 1,
        maxSize: 102400,
        mimeTypes: ["image/svg+xml", "image/png"],
      })
    );
    app.save(col);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    col.fields.removeByName("icon");
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
