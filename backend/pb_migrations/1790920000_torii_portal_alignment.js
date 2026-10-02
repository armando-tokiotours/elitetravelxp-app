/// <reference path="../pb_data/types.d.ts" />
/**
 * Torii portal alignment — per-gate photo offsets + mask size on site_branding.
 * Values stored as text percentages (e.g. "0", "80").
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
        max: max || 16,
      })
    );
  };

  for (const gate of ["multiday", "single", "builder_e"]) {
    addText(`torii_${gate}_mask_x`);
    addText(`torii_${gate}_mask_y`);
    addText(`torii_${gate}_mask_w`);
    addText(`torii_${gate}_mask_h`);
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const gate of ["multiday", "single", "builder_e"]) {
      for (const axis of ["mask_x", "mask_y", "mask_w", "mask_h"]) {
        const f = col.fields.getByName(`torii_${gate}_${axis}`);
        if (f) col.fields.removeById(f.id);
      }
    }
    app.save(col);
  } catch (_) {}
});
