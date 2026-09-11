/// <reference path="../pb_data/types.d.ts" />
/**
 * Schema: cities, accommodations, vehicles, transfers, tours
 * Public read (list/view) so the Trip Builder can fetch config without auth.
 */
migrate((app) => {
  const cities = new Collection({
    type: "base",
    name: "cities",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 120,
      },
      {
        name: "image",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      },
      {
        name: "base_price_modifier",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "sort_order",
        type: "number",
        min: 0,
      },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_cities_name ON cities (name)"],
  });
  app.save(cities);

  const accommodations = new Collection({
    type: "base",
    name: "accommodations",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "tier",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["4-star", "5-star"],
      },
      {
        name: "room_type",
        type: "text",
        required: true,
      },
      {
        name: "min_price",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "max_price",
        type: "number",
        required: true,
        min: 0,
      },
    ],
  });
  app.save(accommodations);

  const vehicles = new Collection({
    type: "base",
    name: "vehicles",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "type",
        type: "text",
        required: true,
      },
      {
        name: "max_passengers",
        type: "number",
        required: true,
        min: 1,
      },
      {
        name: "price_per_day",
        type: "number",
        required: true,
        min: 0,
      },
    ],
  });
  app.save(vehicles);

  const transfers = new Collection({
    type: "base",
    name: "transfers",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "location",
        type: "text",
        required: true,
      },
      {
        name: "pickup_fee",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "dropoff_fee",
        type: "number",
        required: true,
        min: 0,
      },
    ],
  });
  app.save(transfers);

  // Reload cities to get id for relation
  const citiesCol = app.findCollectionByNameOrId("cities");

  const tours = new Collection({
    type: "base",
    name: "tours",
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
        collectionId: citiesCol.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "price",
        type: "number",
        required: true,
        min: 0,
      },
    ],
  });
  app.save(tours);

  // Transit modes (for location-to-location dropdown)
  const transit = new Collection({
    type: "base",
    name: "transit_modes",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "label",
        type: "text",
        required: true,
      },
      {
        name: "price_per_leg",
        type: "number",
        required: true,
        min: 0,
      },
    ],
  });
  app.save(transit);
}, (app) => {
  for (const name of [
    "tours",
    "transit_modes",
    "transfers",
    "vehicles",
    "accommodations",
    "cities",
  ]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch (_) {
      /* already gone */
    }
  }
});
