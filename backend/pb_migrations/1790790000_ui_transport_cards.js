/// <reference path="../pb_data/types.d.ts" />
/**
 * Editable transport selection cards (Self / Public / Private).
 * Managed from Team Access → Site Branding.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ui_transport_cards");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "ui_transport_cards",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "mode_id",
        type: "text",
        required: true,
        min: 1,
        max: 40,
      },
      {
        name: "title",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "description",
        type: "text",
        required: false,
        max: 400,
      },
      {
        name: "subtext",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "image",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ],
        thumbs: ["100x100", "400x400", "600x400"],
      },
      {
        name: "sort_order",
        type: "number",
        required: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_ui_transport_cards_mode ON ui_transport_cards (`mode_id`)",
    ],
  });

  app.save(col);

  const seeds = [
    {
      mode_id: "self",
      title: "Self-arranged",
      description: "Walk · taxi · on your own · €0 invoice",
      subtext: "Invoice €0",
      sort_order: 1,
    },
    {
      mode_id: "public",
      title: "Public transport",
      description: "Shinkansen · metro · Suica tickets",
      subtext: "",
      sort_order: 2,
    },
    {
      mode_id: "private",
      title: "Private chauffeur",
      description: "Door-to-door pick-up · vanity van",
      subtext: "",
      sort_order: 3,
    },
  ];

  for (const seed of seeds) {
    app.save(new Record(col, seed));
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ui_transport_cards"));
  } catch (_) {
    /* already gone */
  }
});
