/// <reference path="../pb_data/types.d.ts" />
/**
 * Ensure singleton site_branding row exists.
 * Collection itself is created by 1740000005_site_branding.js
 * (this file was auto-exported with a conflicting create — kept as seed only).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("site_branding");
  } catch (_) {
    return;
  }

  const rows = app.findAllRecords(col);
  if (rows.length > 0) return;

  const record = new Record(col, {
    hero_title_main: "Build Your",
    hero_title_highlight: "Perfect Japan Trip",
    hero_subtitle: "Design every detail. We'll take care of the rest.",
  });
  app.save(record);
}, (app) => {
  /* keep branding data on down */
});
