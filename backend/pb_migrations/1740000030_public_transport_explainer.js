/// <reference path="../pb_data/types.d.ts" />
/**
 * Seed public_transport feature explainer for City Transport modal.
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
      if (!keyField.values.includes("public_transport")) {
        keyField.values = [...keyField.values, "public_transport"];
        app.save(col);
      }
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const existing = app.findFirstRecordByFilter(
      col,
      'feature_key = "public_transport"'
    );
    if (existing) return;
  } catch (_) {
    /* create below */
  }

  const record = new Record(col, {
    feature_key: "public_transport",
    title: "Public Transport in Japan",
    description:
      "Japan’s rail and subway network is fast and extensive — but transfers, stairs, and station walking can be demanding with luggage or a full day of experiences. Watch this short guide to decide when public transit fits your pace, and when a private chauffeur is the clearer choice.",
    media_type: "Video",
  });
  app.save(record);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    const row = app.findFirstRecordByFilter(
      col,
      'feature_key = "public_transport"'
    );
    if (row) app.delete(row);
  } catch (_) {}
});
