/// <reference path="../pb_data/types.d.ts" />
/**
 * Arrival / Departure hubs (airports & cruise terminals).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("hubs");
    return;
  } catch (_) {
    /* create */
  }

  let citiesId = "";
  try {
    citiesId = app.findCollectionByNameOrId("cities").id;
  } catch (_) {}

  const fields = [
    {
      name: "name",
      type: "text",
      required: true,
      min: 1,
      max: 200,
    },
    {
      name: "type",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["Airport", "Cruise Terminal"],
    },
    {
      name: "pickup_fee",
      type: "number",
      required: false,
      min: 0,
    },
    {
      name: "dropoff_fee",
      type: "number",
      required: false,
      min: 0,
    },
    {
      name: "is_active",
      type: "bool",
    },
    {
      name: "sort_order",
      type: "number",
      min: 0,
    },
  ];

  if (citiesId) {
    fields.splice(2, 0, {
      name: "city_id",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: citiesId,
      cascadeDelete: false,
    });
  }

  const col = new Collection({
    type: "base",
    name: "hubs",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields,
  });

  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("hubs"));
  } catch (_) {}
});
