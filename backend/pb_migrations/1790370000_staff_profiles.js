/// <reference path="../pb_data/types.d.ts" />
/**
 * staff_profiles — 1:1 with staff auth (bio, languages, cities, media, payout details).
 * Does not live on booking PNR pockets.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("staff_profiles");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "staff_profiles",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "staff_id", type: "text", required: true, max: 64 },
      { name: "display_name", type: "text", required: false, max: 200 },
      { name: "phone", type: "text", required: false, max: 64 },
      { name: "bio", type: "text", required: false, max: 5000 },
      { name: "languages", type: "text", required: false, max: 500 },
      { name: "strength_cities", type: "text", required: false, max: 500 },
      {
        name: "photo",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        thumbs: ["100x100"],
      },
      {
        name: "video",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: ["video/mp4", "video/webm"],
      },
      { name: "video_url", type: "url", required: false },
      { name: "bank_info", type: "text", required: false, max: 2000 },
      { name: "payment_link", type: "url", required: false },
      { name: "payout_notes", type: "text", required: false, max: 2000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_staff_profiles_staff ON staff_profiles (`staff_id`)",
    ],
  });
  app.save(col);

  // Backfill empty profiles for existing staff
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const profiles = app.findCollectionByNameOrId("staff_profiles");
    const rows = app.findRecordsByFilter(staff, "id != ''", "", 500, 0);
    for (const s of rows) {
      const sid = String(s.id || "").trim();
      if (!sid) continue;
      let exists = null;
      try {
        exists = app.findFirstRecordByFilter(
          profiles,
          `staff_id="${sid.replace(/"/g, "")}"`
        );
      } catch (_) {
        exists = null;
      }
      if (exists) continue;
      const rec = new Record(profiles);
      rec.set("staff_id", sid);
      rec.set("display_name", String(s.get("name") || "").trim());
      app.save(rec);
    }
  } catch (_) {
    /* staff may be empty */
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("staff_profiles"));
  } catch (_) {
    /* ignore */
  }
});
