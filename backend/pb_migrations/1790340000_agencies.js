/// <reference path="../pb_data/types.d.ts" />
/**
 * Agencies (Silo 2 partners) — light registry for agency staff linkage.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("agencies");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "agencies",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        max: 200,
      },
      {
        name: "code",
        type: "text",
        required: false,
        max: 64,
      },
      {
        name: "contact_email",
        type: "email",
        required: false,
      },
      {
        name: "notes",
        type: "text",
        required: false,
        max: 5000,
      },
      {
        name: "active",
        type: "bool",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE INDEX idx_agencies_code ON agencies (`code`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("agencies"));
  } catch (_) {
    /* ignore */
  }
});
