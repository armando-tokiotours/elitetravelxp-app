/// <reference path="../pb_data/types.d.ts" />
/**
 * Expand accommodations for city/month/season hotel rate matrix.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("accommodations");
  let cities;
  try {
    cities = app.findCollectionByNameOrId("cities");
  } catch (_) {
    cities = null;
  }

  const ensure = (cfg) => {
    try {
      col.fields.getByName(cfg.name);
    } catch (_) {
      col.fields.add(new Field(cfg));
    }
  };

  if (cities) {
    ensure({
      type: "relation",
      name: "city_id",
      required: false,
      maxSelect: 1,
      collectionId: cities.id,
      cascadeDelete: false,
    });
  }

  ensure({
    type: "select",
    name: "star_rating",
    required: false,
    maxSelect: 1,
    values: ["3-star", "4-star", "5-star"],
  });
  ensure({
    type: "select",
    name: "month",
    required: false,
    maxSelect: 1,
    values: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
  });
  ensure({
    type: "select",
    name: "season_tier",
    required: false,
    maxSelect: 1,
    values: ["Low", "Mid", "High"],
  });
  ensure({
    type: "select",
    name: "breakfast",
    required: false,
    maxSelect: 1,
    values: ["Included", "Not Included"],
  });
  ensure({
    type: "number",
    name: "price_min",
    required: false,
  });
  ensure({
    type: "number",
    name: "price_max",
    required: false,
  });

  // Expand room_type options aren't enforced on text fields; star_rating covers 3-star.
  // Expand legacy tier select if possible
  try {
    const tier = col.fields.getByName("tier");
    if (tier && tier.values && !tier.values.includes("3-star")) {
      tier.values = ["3-star", "4-star", "5-star"];
    }
  } catch (_) {}

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("accommodations");
    for (const name of [
      "city_id",
      "star_rating",
      "month",
      "season_tier",
      "breakfast",
      "price_min",
      "price_max",
    ]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
