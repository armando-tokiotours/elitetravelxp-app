/// <reference path="../pb_data/types.d.ts" />
/**
 * Daily private chauffeur rates per city × vehicle.
 * Client applies 30% markup for displayed max (same as airport transfers).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("chauffeur_rates");
    return;
  } catch (_) {
    /* create below */
  }

  let citiesId = "";
  let vehiclesId = "";
  try {
    citiesId = app.findCollectionByNameOrId("cities").id;
    vehiclesId = app.findCollectionByNameOrId("vehicles").id;
  } catch (_) {
    return;
  }

  const col = new Collection({
    type: "base",
    name: "chauffeur_rates",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "city_id",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: citiesId,
        cascadeDelete: true,
      },
      {
        name: "vehicle_id",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: vehiclesId,
        cascadeDelete: true,
      },
      {
        name: "base_daily_rate",
        type: "number",
        required: true,
        min: 0,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_chauffeur_rates_city_vehicle ON chauffeur_rates (`city_id`, `vehicle_id`)",
    ],
  });
  app.save(col);

  let cities = [];
  let vehiclesList = [];
  try {
    cities = app.findAllRecords(app.findCollectionByNameOrId("cities"));
    vehiclesList = app.findAllRecords(app.findCollectionByNameOrId("vehicles"));
  } catch (_) {
    return;
  }

  for (const city of cities) {
    const mod = Number(city.get("base_price_modifier") || 1) || 1;
    for (const veh of vehiclesList) {
      const daily = Number(veh.get("price_per_day") || 0);
      if (daily <= 0) continue;
      const rec = new Record(col);
      rec.set("city_id", city.id);
      rec.set("vehicle_id", veh.id);
      rec.set("base_daily_rate", Math.round(daily * mod));
      app.save(rec);
    }
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("chauffeur_rates"));
  } catch (_) {}
});
