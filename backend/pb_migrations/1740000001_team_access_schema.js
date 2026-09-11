/// <reference path="../pb_data/types.d.ts" />
/**
 * Extend schema for Team Access admin + logic rules.
 * - cities: description, base_price
 * - tours: description, image
 * - vehicles: name (alongside type)
 * - system_rules: key/value logic store
 */
migrate((app) => {
  const cities = app.findCollectionByNameOrId("cities");
  cities.fields.add(
    new Field({
      type: "text",
      name: "description",
      required: false,
      max: 2000,
    })
  );
  cities.fields.add(
    new Field({
      type: "number",
      name: "base_price",
      required: false,
      min: 0,
    })
  );
  app.save(cities);

  const tours = app.findCollectionByNameOrId("tours");
  tours.fields.add(
    new Field({
      type: "text",
      name: "description",
      required: false,
      max: 2000,
    })
  );
  tours.fields.add(
    new Field({
      type: "file",
      name: "image",
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    })
  );
  app.save(tours);

  const vehicles = app.findCollectionByNameOrId("vehicles");
  vehicles.fields.add(
    new Field({
      type: "text",
      name: "name",
      required: false,
      max: 120,
    })
  );
  app.save(vehicles);

  const rules = new Collection({
    type: "base",
    name: "system_rules",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "key",
        type: "text",
        required: true,
        min: 1,
        max: 120,
      },
      {
        name: "value",
        type: "text",
        required: true,
        max: 500,
      },
      {
        name: "label",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "group",
        type: "text",
        required: false,
        max: 80,
      },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_system_rules_key ON system_rules (`key`)"],
  });
  app.save(rules);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("system_rules"));
  } catch (_) {}

  const dropField = (colName, fieldName) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      const f = col.fields.getByName(fieldName);
      if (f) {
        col.fields.removeById(f.id);
        app.save(col);
      }
    } catch (_) {}
  };
  dropField("cities", "description");
  dropField("cities", "base_price");
  dropField("tours", "description");
  dropField("tours", "image");
  dropField("vehicles", "name");
});
