/// <reference path="../pb_data/types.d.ts" />
/**
 * Site Branding → ICONS (CARD BACKGROUNDS) — widen `branding_ui_items.icon`
 * from the original icon spec (SVG/PNG, ≤100KB, migration 1791240000) to
 * card-background photos: JPG/WebP only, ≤300KB (307200 bytes).
 * Recommended dimensions 800×400px (2:1 landscape) are guidance in the
 * admin UI / client validator only — not enforced here.
 * Note: any previously uploaded SVG/PNG files are not deleted by this
 * migration, but new uploads are restricted to JPG/WebP.
 * Applies on PocketBase restart.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");
  const icon = col.fields.getByName("icon");
  if (!icon) return;

  icon.maxSize = 307200; // 300KB
  icon.mimeTypes = ["image/jpeg", "image/webp"];
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    const icon = col.fields.getByName("icon");
    if (!icon) return;
    icon.maxSize = 102400; // 100KB — original 1791240000 spec
    icon.mimeTypes = ["image/svg+xml", "image/png"];
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
