/// <reference path="../pb_data/types.d.ts" />
/**
 * Climate-season mascots for Seasonality cards (winter / summer / rain / default).
 * Team Access → Seasonality → Characters.
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("seasonal_characters");
      return;
    } catch (_) {
      /* create below */
    }

    const col = new Collection({
      type: "base",
      name: "seasonal_characters",
      listRule: "",
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: "key",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["default", "winter", "summer", "rain"],
        },
        {
          name: "label",
          type: "text",
          required: true,
          max: 80,
        },
        {
          name: "start_month",
          type: "number",
          required: false,
          min: 1,
          max: 12,
        },
        {
          name: "start_day",
          type: "number",
          required: false,
          min: 1,
          max: 31,
        },
        {
          name: "end_month",
          type: "number",
          required: false,
          min: 1,
          max: 12,
        },
        {
          name: "end_day",
          type: "number",
          required: false,
          min: 1,
          max: 31,
        },
        {
          name: "mascot",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 1500000,
          mimeTypes: [
            "image/png",
            "image/svg+xml",
            "image/webp",
            "image/jpeg",
          ],
        },
        {
          name: "sort_order",
          type: "number",
          required: false,
        },
        {
          name: "is_active",
          type: "bool",
          required: false,
        },
      ],
    });

    app.save(col);

    const seeds = [
      {
        key: "default",
        label: "Default (no date / off-season)",
        sort_order: 0,
        is_active: true,
      },
      {
        key: "winter",
        label: "Winter",
        start_month: 12,
        start_day: 1,
        end_month: 2,
        end_day: 28,
        sort_order: 10,
        is_active: true,
      },
      {
        key: "rain",
        label: "Rainy season (tsuyu)",
        start_month: 6,
        start_day: 1,
        end_month: 7,
        end_day: 20,
        sort_order: 20,
        is_active: true,
      },
      {
        key: "summer",
        label: "Summer",
        start_month: 7,
        start_day: 21,
        end_month: 8,
        end_day: 31,
        sort_order: 30,
        is_active: true,
      },
    ];

    for (const row of seeds) {
      const rec = new Record(col);
      for (const [k, v] of Object.entries(row)) {
        rec.set(k, v);
      }
      app.save(rec);
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("seasonal_characters"));
    } catch (_) {}
  }
);
