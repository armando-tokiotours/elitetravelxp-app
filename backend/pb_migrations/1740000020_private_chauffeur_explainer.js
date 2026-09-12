/// <reference path="../pb_data/types.d.ts" />
/**
 * Seed private_chauffeur feature explainer (media uploaded in Team Access).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("feature_explainers");
  } catch (_) {
    return;
  }

  try {
    const existing = app.findFirstRecordByFilter(
      col,
      'feature_key = "private_chauffeur"'
    );
    if (existing) return;
  } catch (_) {
    /* create below */
  }

  const record = new Record(col, {
    feature_key: "private_chauffeur",
    title: "The Private Chauffeur Experience",
    description:
      "Travel Japan your way with a dedicated private driver and luxury vehicle. Choose a full-day disposal for seamless door-to-door comfort, or book by experience so your chauffeur is ready when each tour begins — luggage handled, routes planned, and timing left to us.",
    media_type: "Video",
  });
  app.save(record);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    const row = app.findFirstRecordByFilter(
      col,
      'feature_key = "private_chauffeur"'
    );
    if (row) app.delete(row);
  } catch (_) {}
});
