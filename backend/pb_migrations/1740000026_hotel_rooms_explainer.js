/// <reference path="../pb_data/types.d.ts" />
/**
 * Seed hotel_rooms feature explainer (media uploaded in Team Access).
 * Add hotel_rooms to feature_key select options if missing.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("feature_explainers");
  } catch (_) {
    return;
  }

  try {
    const keyField = col.fields.getByName("feature_key");
    if (keyField && Array.isArray(keyField.values)) {
      if (!keyField.values.includes("hotel_rooms")) {
        keyField.values = [...keyField.values, "hotel_rooms"];
        app.save(col);
      }
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const existing = app.findFirstRecordByFilter(
      col,
      'feature_key = "hotel_rooms"'
    );
    if (existing) return;
  } catch (_) {
    /* create below */
  }

  const record = new Record(col, {
    feature_key: "hotel_rooms",
    title: "Japanese Hotel Rooms Explained",
    description:
      "Japanese hotel rooms are often more compact than Western standards. Twin rooms sleep two on separate beds; Standard and Superior options vary by hotel. We calculate how many rooms your party needs based on two guests per room — watch this short guide before choosing your configuration.",
    media_type: "Video",
  });
  app.save(record);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    const row = app.findFirstRecordByFilter(
      col,
      'feature_key = "hotel_rooms"'
    );
    if (row) app.delete(row);
  } catch (_) {}
});
