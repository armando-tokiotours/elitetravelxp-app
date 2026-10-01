/// <reference path="../pb_data/types.d.ts" />
/**
 * Vendor dispatch tokens (tokenized portal links) + ops completion flags.
 * Tokens unlock sanitized vendor views without staff login.
 */
migrate((app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    const has = (name) => {
      try {
        return Boolean(hub.fields.getByName(name));
      } catch (_) {
        return false;
      }
    };
    if (!has("client_briefing_sent")) {
      hub.fields.add(
        new Field({
          type: "bool",
          name: "client_briefing_sent",
          required: false,
        })
      );
    }
    app.save(hub);
  } catch (_) {}

  try {
    app.findCollectionByNameOrId("vendor_dispatch_tokens");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "vendor_dispatch_tokens",
    listRule: "@request.auth.id != ''",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "token", type: "text", required: true, max: 64 },
      { name: "pnr", type: "text", required: true, max: 32 },
      { name: "ops_hub_id", type: "text", required: false, max: 64 },
      {
        name: "vendor_role",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["guide", "driver", "ticketer"],
      },
      { name: "created_by", type: "text", required: false, max: 64 },
      { name: "expires_at", type: "date", required: false },
      { name: "revoked", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_vendor_dispatch_token ON vendor_dispatch_tokens (`token`)",
      "CREATE INDEX idx_vendor_dispatch_pnr ON vendor_dispatch_tokens (`pnr`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("vendor_dispatch_tokens"));
  } catch (_) {}
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    try {
      hub.fields.removeByName("client_briefing_sent");
      app.save(hub);
    } catch (_) {}
  } catch (_) {}
});
