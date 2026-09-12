/// <reference path="../pb_data/types.d.ts" />
/**
 * Airport transfer flat rates per hub × vehicle.
 * Seeds from existing hub pickup/dropoff fees scaled by vehicle size.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("airport_transfers");
    return;
  } catch (_) {
    /* create below */
  }

  let hubsId = "";
  let vehiclesId = "";
  try {
    hubsId = app.findCollectionByNameOrId("hubs").id;
    vehiclesId = app.findCollectionByNameOrId("vehicles").id;
  } catch (_) {
    return;
  }

  // Optional max_pax alias on vehicles (app still reads max_passengers)
  try {
    const vehicles = app.findCollectionByNameOrId("vehicles");
    const existing = vehicles.fields.getByName("max_pax");
    if (!existing) {
      vehicles.fields.add(
        new Field({
          type: "number",
          name: "max_pax",
          required: false,
          min: 1,
        })
      );
      app.save(vehicles);

      // Mirror max_passengers → max_pax for existing rows
      const rows = app.findAllRecords(vehicles);
      for (const row of rows) {
        const pax = row.get("max_passengers");
        if (pax != null && (row.get("max_pax") == null || row.get("max_pax") === 0)) {
          row.set("max_pax", pax);
          app.save(row);
        }
      }
    }
  } catch (_) {
    /* non-fatal */
  }

  const col = new Collection({
    type: "base",
    name: "airport_transfers",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "hub_id",
        type: "relation",
        required: true,
        maxSelect: 1,
        collectionId: hubsId,
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
        name: "pickup_price_min",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "pickup_price_max",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "dropoff_price_min",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "dropoff_price_max",
        type: "number",
        required: true,
        min: 0,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_airport_transfers_hub_vehicle ON airport_transfers (`hub_id`, `vehicle_id`)",
    ],
  });
  app.save(col);

  // Scale factors by capacity band
  const scaleForPax = (pax) => {
    const n = Number(pax) || 0;
    if (n <= 6) return 1;
    if (n <= 10) return 1.35;
    return 1.65;
  };

  let hubs = [];
  let vehiclesList = [];
  try {
    hubs = app.findAllRecords(app.findCollectionByNameOrId("hubs"));
    vehiclesList = app.findAllRecords(app.findCollectionByNameOrId("vehicles"));
  } catch (_) {
    return;
  }

  for (const hub of hubs) {
    const basePick = Number(hub.get("pickup_fee") || 0);
    const baseDrop = Number(hub.get("dropoff_fee") || basePick);
    if (basePick <= 0 && baseDrop <= 0) continue;

    for (const veh of vehiclesList) {
      const pax = Number(veh.get("max_pax") || veh.get("max_passengers") || 0);
      const scale = scaleForPax(pax);
      const pick = Math.round(basePick * scale);
      const drop = Math.round(baseDrop * scale);
      const rec = new Record(col);
      rec.set("hub_id", hub.id);
      rec.set("vehicle_id", veh.id);
      rec.set("pickup_price_min", pick);
      rec.set("pickup_price_max", Math.round(pick * 1.12));
      rec.set("dropoff_price_min", drop);
      rec.set("dropoff_price_max", Math.round(drop * 1.12));
      app.save(rec);
    }
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("airport_transfers"));
  } catch (_) {}
});
