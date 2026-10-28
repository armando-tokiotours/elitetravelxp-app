/// <reference path="../pb_data/types.d.ts" />
/**
 * Homepage hero GRID PANELS p1–p6 — per-panel uploaded media.
 * Mirrors 1791300000 (card videos) / 1790930000 (card photos):
 * one optional image (webp/png/jpg ≤10MB) + one optional video
 * (mp4/webm ≤50MB) per panel. The panel's media type + external
 * embed URL live in hero_intro_config JSON (gridPanels), not here.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");

  const addFile = (name, maxSize, mimeTypes) => {
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
        maxSize,
        mimeTypes,
      })
    );
  };

  for (let n = 1; n <= 6; n++) {
    addFile(`hero_panel_p${n}_image`, 10485760, [
      "image/webp",
      "image/png",
      "image/jpeg",
    ]);
    addFile(`hero_panel_p${n}_video`, 52428800, [
      "video/mp4",
      "video/webm",
    ]);
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (let n = 1; n <= 6; n++) {
      for (const name of [`hero_panel_p${n}_image`, `hero_panel_p${n}_video`]) {
        const f = col.fields.getByName(name);
        if (f) col.fields.removeById(f.id);
      }
    }
    app.save(col);
  } catch (_) {}
});
