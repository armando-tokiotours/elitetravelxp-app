/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours: replace single base_price with tiered pax pricing.
 * Legacy base_price / price_per_person / price were per-person — backfill
 * group tiers as unit × pax so existing quotes stay roughly consistent.
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  const tierFields = [
    "price_1_pax",
    "price_2_pax",
    "price_3_pax",
    "price_4_pax",
    "price_extra_pax",
  ];

  for (const name of tierFields) {
    if (missing(name)) {
      tours.fields.add(
        new Field({
          type: "number",
          name,
          required: false,
          min: 0,
        })
      );
    }
  }
  app.save(tours);

  const rows = app.findAllRecords(tours);
  for (const row of rows) {
    const unit =
      Number(row.get("base_price") ?? 0) ||
      Number(row.get("price_per_person") ?? 0) ||
      Number(row.get("price") ?? 0) ||
      0;

    const existing1 = Number(row.get("price_1_pax") ?? 0);
    if (!existing1 && unit > 0) {
      row.set("price_1_pax", unit * 1);
      row.set("price_2_pax", unit * 2);
      row.set("price_3_pax", unit * 3);
      row.set("price_4_pax", unit * 4);
      row.set("price_extra_pax", unit);
      app.save(row);
    }
  }

  // Drop tours.base_price (cities.base_price is unrelated)
  try {
    const f = tours.fields.getByName("base_price");
    if (f) {
      tours.fields.removeById(f.id);
      app.save(tours);
    }
  } catch (_) {
    /* already gone */
  }
}, (app) => {
  /* keep tier fields on down */
});
