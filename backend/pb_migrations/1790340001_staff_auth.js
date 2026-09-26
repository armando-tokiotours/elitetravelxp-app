/// <reference path="../pb_data/types.d.ts" />
/**
 * Staff auth collection — Google Workspace–ready (password now; OAuth later).
 * Roles: owner | ops | ticketer | guide | driver | agency
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("staff");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "auth",
    name: "staff",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    authRule: "",
    manageRule: null,
    passwordAuth: {
      enabled: true,
      identityFields: ["email"],
    },
    oauth2: {
      enabled: false,
      providers: [],
      mappedFields: {
        name: "name",
      },
    },
    fields: [
      {
        name: "name",
        type: "text",
        required: false,
        max: 200,
      },
      {
        name: "role",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["owner", "ops", "ticketer", "guide", "driver", "agency"],
      },
      {
        name: "agency_id",
        type: "text",
        required: false,
        max: 64,
      },
      {
        name: "active",
        type: "bool",
        required: false,
      },
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("staff"));
  } catch (_) {
    /* ignore */
  }
});
