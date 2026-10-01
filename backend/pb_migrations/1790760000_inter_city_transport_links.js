/// <reference path="../pb_data/types.d.ts" />
/**
 * Transport engine: link inter-city routes → transport_products,
 * plus per-city self-arrange taxi / subway comparison rates.
 */
migrate((app) => {
  // —— city_movements.linked_transport_product_id ——
  try {
    const movements = app.findCollectionByNameOrId("city_movements");
    if (!movements.fields.getByName("linked_transport_product_id")) {
      let productsId = "";
      try {
        productsId = app.findCollectionByNameOrId("transport_products").id;
      } catch (_) {
        productsId = "";
      }
      if (productsId) {
        movements.fields.add(
          new Field({
            type: "relation",
            name: "linked_transport_product_id",
            required: false,
            maxSelect: 1,
            collectionId: productsId,
            cascadeDelete: false,
          })
        );
      } else {
        movements.fields.add(
          new Field({
            type: "text",
            name: "linked_transport_product_id",
            required: false,
            max: 64,
          })
        );
      }
      app.save(movements);
    }
  } catch (_) {
    /* city_movements missing */
  }

  // —— cities self-arrange comparison rates ——
  try {
    const cities = app.findCollectionByNameOrId("cities");
    const addNum = (name) => {
      if (!cities.fields.getByName(name)) {
        cities.fields.add(
          new Field({
            type: "number",
            name,
            required: false,
            min: 0,
          })
        );
      }
    };
    addNum("avg_taxi_eur");
    addNum("avg_subway_day_eur");
    addNum("taxi_wait_mins");
    app.save(cities);
  } catch (_) {
    /* cities missing */
  }

  // —— explainer keys ——
  try {
    const col = app.findCollectionByNameOrId("feature_explainers");
    const keyField = col.fields.getByName("feature_key");
    if (keyField && Array.isArray(keyField.values)) {
      const need = ["public_transport", "self_arranged_transport"];
      let changed = false;
      for (const k of need) {
        if (!keyField.values.includes(k)) {
          keyField.values = [...keyField.values, k];
          changed = true;
        }
      }
      if (changed) app.save(col);
    }

    try {
      app.findFirstRecordByFilter(
        col,
        'feature_key = "self_arranged_transport"'
      );
    } catch (_) {
      const record = new Record(col, {
        feature_key: "self_arranged_transport",
        title: "Self-arranged local transport",
        description:
          "Choosing Self means TokioTours does not book your city hops. Expect typical taxi/Uber fares, subway day spend, and wait times — useful for comparing against Public or Private options we can arrange for you.",
        media_type: "Video",
      });
      app.save(record);
    }
  } catch (_) {
    /* feature_explainers missing */
  }
}, (app) => {
  try {
    const movements = app.findCollectionByNameOrId("city_movements");
    const f = movements.fields.getByName("linked_transport_product_id");
    if (f) {
      movements.fields.removeByName("linked_transport_product_id");
      app.save(movements);
    }
  } catch (_) {}
  try {
    const cities = app.findCollectionByNameOrId("cities");
    for (const name of [
      "avg_taxi_eur",
      "avg_subway_day_eur",
      "taxi_wait_mins",
    ]) {
      if (cities.fields.getByName(name)) {
        cities.fields.removeByName(name);
      }
    }
    app.save(cities);
  } catch (_) {}
});
