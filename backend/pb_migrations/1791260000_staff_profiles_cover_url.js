/// <reference path="../pb_data/types.d.ts" />
/**
 * staff_profiles.cover_url — landscape cover/banner image for the
 * social-style contractor profile (Guide Portal). Stored as a URL
 * (/uploads/profiles/... from /api/upload), not a PB file field.
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    if (!col.fields.getByName("cover_url")) {
      col.fields.add(
        new Field({
          type: "text",
          name: "cover_url",
          required: false,
          max: 500,
        })
      );
      app.save(col);
      console.log("[1791260000] staff_profiles.cover_url ready");
    }
  } catch (e) {
    console.log("[1791260000] staff_profiles.cover_url:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    try {
      col.fields.removeByName("cover_url");
    } catch (_) {
      /* ignore */
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
