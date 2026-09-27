/// <reference path="../pb_data/types.d.ts" />
/**
 * Allow video on branding_ui_items.poster (Pre-Builder story slide 2,
 * pace cards, etc.). Previously images-only @ 10MB → "Failed to update record"
 * when Team Access uploaded MP4/WebM to slide 2.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");
  const poster = col.fields.getByName("poster");
  if (!poster) return;

  poster.maxSize = 52428800; // 50MB — match `media`
  poster.mimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
  ];
  // Keep existing thumbs for images; PB skips video thumb generation.

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branding_ui_items");
    const poster = col.fields.getByName("poster");
    if (!poster) return;
    poster.maxSize = 10485760;
    poster.mimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
