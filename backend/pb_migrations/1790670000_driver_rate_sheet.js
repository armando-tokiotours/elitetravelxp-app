/// <reference path="../pb_data/types.d.ts" />
/**
 * driver_rate_sheet — per-driver negotiated transport costs.
 */
migrate((app) => {
  let driversId = "";
  let vehiclesId = "";
  let citiesId = "";
  let airportTransfersId = "";
  try {
    driversId = app.findCollectionByNameOrId("drivers").id;
    vehiclesId = app.findCollectionByNameOrId("vehicles").id;
  } catch (_) {
    return;
  }
  try {
    citiesId = app.findCollectionByNameOrId("cities").id;
  } catch (_) {}
  try {
    airportTransfersId = app.findCollectionByNameOrId("airport_transfers").id;
  } catch (_) {}

  try {
    app.findCollectionByNameOrId("driver_rate_sheet");
    return;
  } catch (_) {
    /* create */
  }

  const fields = [
    {
      name: "driver",
      type: "relation",
      required: true,
      maxSelect: 1,
      collectionId: driversId,
      cascadeDelete: true,
    },
    {
      name: "rate_type",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["transfer", "intercity", "hourly_chauffeur"],
    },
    {
      name: "vehicle",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: vehiclesId,
      cascadeDelete: false,
    },
    { name: "route_key", type: "text", required: false, max: 120 },
    { name: "route_name", type: "text", required: false, max: 300 },
    {
      name: "driver_cost_jpy",
      type: "number",
      required: true,
      min: 0,
    },
    { name: "extra_hour_rate_jpy", type: "number", required: false, min: 0 },
    {
      name: "night_surge_percentage",
      type: "number",
      required: false,
      min: 0,
    },
    { name: "tolls_parking_included", type: "bool", required: false },
    { name: "is_active", type: "bool", required: false },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  if (airportTransfersId) {
    fields.splice(3, 0, {
      name: "airport_transfer",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: airportTransfersId,
      cascadeDelete: false,
    });
  }
  if (citiesId) {
    fields.splice(airportTransfersId ? 4 : 3, 0, {
      name: "city",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: citiesId,
      cascadeDelete: false,
    });
  }

  const col = new Collection({
    type: "base",
    name: "driver_rate_sheet",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields,
    indexes: [
      "CREATE INDEX idx_driver_rate_sheet_driver ON driver_rate_sheet (`driver`)",
      "CREATE INDEX idx_driver_rate_sheet_type ON driver_rate_sheet (`rate_type`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("driver_rate_sheet"));
  } catch (_) {}
});
