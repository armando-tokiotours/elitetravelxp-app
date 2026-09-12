/// <reference path="../pb_data/types.d.ts" />
/**
 * airport_transfers: replace min/max columns with single base fees.
 * Client adds 30% markup for the displayed max.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("airport_transfers");

  const missing = (name) => {
    try {
      return !col.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  // 1) Add as optional so existing rows can be updated
  if (missing("base_pickup_fee")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "base_pickup_fee",
        required: false,
        min: 0,
      })
    );
  }
  if (missing("base_dropoff_fee")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "base_dropoff_fee",
        required: false,
        min: 0,
      })
    );
  }
  app.save(col);

  // 2) Copy legacy min → base
  const rows = app.findAllRecords(col);
  for (const row of rows) {
    const pick =
      row.get("base_pickup_fee") ??
      row.get("pickup_price_min") ??
      0;
    const drop =
      row.get("base_dropoff_fee") ??
      row.get("dropoff_price_min") ??
      pick;
    row.set("base_pickup_fee", Number(pick) || 0);
    row.set("base_dropoff_fee", Number(drop) || 0);
    app.save(row);
  }

  // 3) Mark base fields required
  try {
    const pickF = col.fields.getByName("base_pickup_fee");
    if (pickF) pickF.required = true;
  } catch (_) {}
  try {
    const dropF = col.fields.getByName("base_dropoff_fee");
    if (dropF) dropF.required = true;
  } catch (_) {}
  app.save(col);

  // 4) Drop legacy min/max fields
  const dropNames = [
    "pickup_price_min",
    "pickup_price_max",
    "dropoff_price_min",
    "dropoff_price_max",
  ];
  let changed = false;
  for (const name of dropNames) {
    try {
      const f = col.fields.getByName(name);
      if (f) {
        col.fields.removeById(f.id);
        changed = true;
      }
    } catch (_) {
      /* already gone */
    }
  }
  if (changed) app.save(col);
}, (app) => {});
