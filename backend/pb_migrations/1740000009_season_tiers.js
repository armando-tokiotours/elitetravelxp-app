/// <reference path="../pb_data/types.d.ts" />
/**
 * Seasonality rules: map month + day range → Low/Mid/High tier + concierge note.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("season_tiers");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "season_tiers",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "month",
        type: "select",
        required: true,
        maxSelect: 1,
        values: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
      },
      {
        name: "start_day",
        type: "number",
        required: true,
        min: 1,
        max: 31,
      },
      {
        name: "end_day",
        type: "number",
        required: true,
        min: 1,
        max: 31,
      },
      {
        name: "tier",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["Low", "Mid", "High"],
      },
      {
        name: "crowd_level",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "concierge_note",
        type: "text",
        required: false,
        max: 2000,
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
      month: "January",
      start_day: 1,
      end_day: 3,
      tier: "High",
      crowd_level: "High Crowds",
      concierge_note:
        "New Year holidays. Many attractions closed or busy — book early and expect premium rates.",
      sort_order: 10,
      is_active: true,
    },
    {
      month: "January",
      start_day: 4,
      end_day: 31,
      tier: "Low",
      crowd_level: "Quiet",
      concierge_note:
        "Quiet winter travel. Great for culture and hot springs with softer hotel rates.",
      sort_order: 20,
      is_active: true,
    },
    {
      month: "March",
      start_day: 20,
      end_day: 31,
      tier: "High",
      crowd_level: "High Crowds",
      concierge_note:
        "Cherry blossom season begins late March. Expect peak crowds and premium pricing.",
      sort_order: 30,
      is_active: true,
    },
    {
      month: "April",
      start_day: 1,
      end_day: 15,
      tier: "High",
      crowd_level: "High Crowds",
      concierge_note:
        "Peak sakura season. Hotels and popular spots fill quickly — High season rates apply.",
      sort_order: 40,
      is_active: true,
    },
    {
      month: "April",
      start_day: 16,
      end_day: 30,
      tier: "Mid",
      crowd_level: "Moderate Crowds",
      concierge_note:
        "Post-sakura shoulder. Still lively in major cities with Mid season pricing.",
      sort_order: 50,
      is_active: true,
    },
    {
      month: "September",
      start_day: 1,
      end_day: 30,
      tier: "Mid",
      crowd_level: "Moderate Crowds",
      concierge_note:
        "Early autumn. Pleasant weather and Mid season rates before foliage peak.",
      sort_order: 60,
      is_active: true,
    },
    {
      month: "November",
      start_day: 1,
      end_day: 30,
      tier: "High",
      crowd_level: "High Crowds",
      concierge_note:
        "Autumn foliage season. Expect busy temples and High season hotel rates.",
      sort_order: 70,
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
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("season_tiers"));
  } catch (_) {}
});
