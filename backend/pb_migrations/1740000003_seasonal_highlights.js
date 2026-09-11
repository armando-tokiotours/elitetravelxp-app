/// <reference path="../pb_data/types.d.ts" />
/**
 * Seasonal highlights for concierge date×city recommendations.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("seasonal_highlights");
    return;
  } catch (_) {
    /* create below */
  }

  const cities = app.findCollectionByNameOrId("cities");
  const tours = app.findCollectionByNameOrId("tours");

  const col = new Collection({
    type: "base",
    name: "seasonal_highlights",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },
      {
        name: "city_id",
        type: "relation",
        required: false,
        maxSelect: 1,
        collectionId: cities.id,
        cascadeDelete: false,
      },
      {
        name: "start_month",
        type: "number",
        required: true,
        min: 1,
        max: 12,
      },
      {
        name: "start_day",
        type: "number",
        required: true,
        min: 1,
        max: 31,
      },
      {
        name: "end_month",
        type: "number",
        required: true,
        min: 1,
        max: 12,
      },
      {
        name: "end_day",
        type: "number",
        required: true,
        min: 1,
        max: 31,
      },
      {
        name: "description",
        type: "text",
        required: false,
        max: 4000,
      },
      {
        name: "suggested_tour_id",
        type: "relation",
        required: false,
        maxSelect: 1,
        collectionId: tours.id,
        cascadeDelete: false,
      },
      {
        name: "badge_text",
        type: "text",
        required: false,
        max: 80,
      },
      {
        name: "cover_photo",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      },
      {
        name: "is_active",
        type: "bool",
      },
    ],
  });

  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("seasonal_highlights"));
  } catch (_) {}
});
