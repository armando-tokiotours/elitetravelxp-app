/// <reference path="../pb_data/types.d.ts" />
/**
 * Inter-city movement rules: transit times/costs + recommended travel direction.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("city_movements");
    return;
  } catch (_) {
    /* create below */
  }

  let citiesId = "";
  try {
    citiesId = app.findCollectionByNameOrId("cities").id;
  } catch (_) {
    return;
  }

  const col = new Collection({
    type: "base",
    name: "city_movements",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "from_city_id",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: citiesId,
        cascadeDelete: false,
      },
      {
        name: "to_city_id",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: citiesId,
        cascadeDelete: false,
      },
      {
        name: "public_transit_time_mins",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "public_transit_cost",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "private_transit_time_mins",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "private_transit_cost",
        type: "number",
        required: false,
        min: 0,
      },
      {
        name: "is_recommended_order",
        type: "bool",
        required: false,
      },
    ],
  });

  app.save(col);

  // Seed common Japan corridor routes when cities exist
  const citiesCol = app.findCollectionByNameOrId("cities");
  const allCities = app.findAllRecords(citiesCol);
  const byName = {};
  for (const c of allCities) {
    byName[String(c.get("name"))] = c.id;
  }

  const seeds = [
    ["Tokyo", "Kyoto", 130, 90, 300, 600, true],
    ["Kyoto", "Tokyo", 130, 90, 300, 600, false],
    ["Kyoto", "Osaka", 30, 25, 60, 180, true],
    ["Osaka", "Kyoto", 30, 25, 60, 180, false],
    ["Osaka", "Hiroshima", 95, 70, 240, 480, true],
    ["Hiroshima", "Osaka", 95, 70, 240, 480, false],
    ["Tokyo", "Hakone", 90, 40, 120, 280, true],
    ["Hakone", "Tokyo", 90, 40, 120, 280, false],
    ["Hakone", "Kyoto", 150, 100, 280, 550, true],
    ["Kyoto", "Hakone", 150, 100, 280, 550, false],
    ["Tokyo", "Hiroshima", 240, 140, 480, 900, true],
    ["Hiroshima", "Tokyo", 240, 140, 480, 900, false],
    ["Tokyo", "Osaka", 150, 100, 320, 650, true],
    ["Osaka", "Tokyo", 150, 100, 320, 650, false],
    ["Kyoto", "Hiroshima", 110, 80, 260, 520, true],
    ["Hiroshima", "Kyoto", 110, 80, 260, 520, false],
  ];

  for (const row of seeds) {
    const fromId = byName[row[0]];
    const toId = byName[row[1]];
    if (!fromId || !toId) continue;
    const rec = new Record(col);
    rec.set("from_city_id", fromId);
    rec.set("to_city_id", toId);
    rec.set("public_transit_time_mins", row[2]);
    rec.set("public_transit_cost", row[3]);
    rec.set("private_transit_time_mins", row[4]);
    rec.set("private_transit_cost", row[5]);
    rec.set("is_recommended_order", row[6]);
    app.save(rec);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("city_movements"));
  } catch (_) {}
});
