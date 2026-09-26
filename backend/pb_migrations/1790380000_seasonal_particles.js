/// <reference path="../pb_data/types.d.ts" />
/**
 * Ambient particle seasons (sakura / snow / momiji) with editable date windows
 * and optional custom glyph icons for Team Access → Seasonality → Particles.
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("seasonal_particles");
      return;
    } catch (_) {
      /* create below */
    }

    const col = new Collection({
      type: "base",
      name: "seasonal_particles",
      listRule: "",
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: "season",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["sakura", "snow", "momiji"],
        },
        {
          name: "label",
          type: "text",
          required: true,
          max: 120,
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
          name: "icon",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 120000,
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
        season: "sakura",
        label: "Sakura Peak Season Detected",
        start_month: 3,
        start_day: 1,
        end_month: 5,
        end_day: 31,
        sort_order: 10,
        is_active: true,
      },
      {
        season: "snow",
        label: "Hokkaido Powder Snow",
        start_month: 12,
        start_day: 1,
        end_month: 2,
        end_day: 28,
        sort_order: 20,
        is_active: true,
      },
      {
        season: "momiji",
        label: "Momiji Foliage Season",
        start_month: 9,
        start_day: 1,
        end_month: 11,
        end_day: 30,
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
      app.delete(app.findCollectionByNameOrId("seasonal_particles"));
    } catch (_) {}
  }
);
