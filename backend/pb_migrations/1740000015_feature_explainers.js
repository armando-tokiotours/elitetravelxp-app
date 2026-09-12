/// <reference path="../pb_data/types.d.ts" />
/**
 * Feature explainer videos/copy for builder service explainers
 * (airport pickup, elite concierge, etc.).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("feature_explainers");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "feature_explainers",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "feature_key",
        type: "text",
        required: true,
        min: 1,
        max: 80,
      },
      {
        name: "title",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },
      {
        name: "description",
        type: "text",
        required: false,
        max: 5000,
      },
      {
        name: "media_type",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["Video", "Image"],
      },
      {
        name: "media_file",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-m4v",
        ],
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_feature_explainers_key ON feature_explainers (`feature_key`)",
    ],
  });

  app.save(col);

  // Seed default airport pickup explainer (media uploaded via Team Access)
  const record = new Record(col, {
    feature_key: "airport_pickup",
    title: "The VIP Airport Arrival",
    description:
      "Skip the queue and start your journey in comfort. Our private chauffeur meets you at arrivals with a name board, handles luggage, and takes you straight to your hotel — no taxis, no stress.",
    media_type: "Video",
  });
  app.save(record);

  const concierge = new Record(col, {
    feature_key: "elite_concierge",
    title: "Elite Concierge",
    description:
      "One dedicated specialist plans every detail — restaurants, experiences, and logistics — so you travel without the guesswork.",
    media_type: "Video",
  });
  app.save(concierge);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    app.delete(col);
  } catch (_) {
    /* already gone */
  }
});
