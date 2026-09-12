/// <reference path="../pb_data/types.d.ts" />
/**
 * Backfill airport_transfers base fees from hub pickup/dropoff when still zero.
 * Uses the same vehicle capacity scale as the original seed.
 */
migrate((app) => {
  let col;
  let hubsCol;
  let vehiclesCol;
  try {
    col = app.findCollectionByNameOrId("airport_transfers");
    hubsCol = app.findCollectionByNameOrId("hubs");
    vehiclesCol = app.findCollectionByNameOrId("vehicles");
  } catch (_) {
    return;
  }

  const scaleForPax = (pax) => {
    const n = Number(pax) || 0;
    if (n <= 6) return 1;
    if (n <= 10) return 1.35;
    return 1.65;
  };

  const hubs = {};
  for (const h of app.findAllRecords(hubsCol)) {
    hubs[h.id] = {
      pick: Number(h.get("pickup_fee") || 0),
      drop: Number(h.get("dropoff_fee") || h.get("pickup_fee") || 0),
    };
  }

  const vehicleScale = {};
  for (const v of app.findAllRecords(vehiclesCol)) {
    const pax = Number(v.get("max_pax") || v.get("max_passengers") || 0);
    vehicleScale[v.id] = scaleForPax(pax);
  }

  const rows = app.findAllRecords(col);
  for (const row of rows) {
    const pick = Number(row.get("base_pickup_fee") || 0);
    const drop = Number(row.get("base_dropoff_fee") || 0);
    if (pick > 0 && drop > 0) continue;

    const hub = hubs[row.get("hub_id")];
    const scale = vehicleScale[row.get("vehicle_id")] ?? 1;
    if (!hub || (hub.pick <= 0 && hub.drop <= 0)) continue;

    if (pick <= 0) {
      row.set("base_pickup_fee", Math.round(hub.pick * scale));
    }
    if (drop <= 0) {
      row.set("base_dropoff_fee", Math.round(hub.drop * scale));
    }
    app.save(row);
  }
}, (app) => {});
