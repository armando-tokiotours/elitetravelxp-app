/// <reference path="../pb_data/types.d.ts" />
/**
 * Seed Step 5 explainer keys: guide_explainer + daily_transport_explainer.
 * Adds them to feature_key select options when present; media uploaded in Team Access.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("feature_explainers");
  } catch (_) {
    return;
  }

  const keys = ["guide_explainer", "daily_transport_explainer"];

  try {
    const keyField = col.fields.getByName("feature_key");
    if (keyField && Array.isArray(keyField.values)) {
      let changed = false;
      for (const k of keys) {
        if (!keyField.values.includes(k)) {
          keyField.values = [...keyField.values, k];
          changed = true;
        }
      }
      if (changed) app.save(col);
    }
  } catch (_) {
    /* ignore — field may still be plain text */
  }

  const seeds = [
    {
      feature_key: "guide_explainer",
      title: "Why you need a private guide in Japan",
      description:
        "A private guide unlocks language, etiquette, and access that transform a Japan trip — from temple protocol to neighborhood gems you would never find alone. Watch this short film to see how guided days elevate every stop on your route.",
    },
    {
      feature_key: "daily_transport_explainer",
      title: "Why you need private daily transport",
      description:
        "Luggage, transfers, and timing add friction on public transit. A dedicated private vehicle keeps your party moving door-to-door with comfort and flexibility — ideal between cities and for experience-packed days.",
    },
  ];

  for (const seed of seeds) {
    try {
      const existing = app.findFirstRecordByFilter(
        col,
        `feature_key = "${seed.feature_key}"`
      );
      if (existing) continue;
    } catch (_) {
      /* create below */
    }

    const record = new Record(col, {
      feature_key: seed.feature_key,
      title: seed.title,
      description: seed.description,
      media_type: "Video",
    });
    app.save(record);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    for (const key of ["guide_explainer", "daily_transport_explainer"]) {
      try {
        const row = app.findFirstRecordByFilter(
          col,
          `feature_key = "${key}"`
        );
        if (row) app.delete(row);
      } catch (_) {}
    }
  } catch (_) {}
});
