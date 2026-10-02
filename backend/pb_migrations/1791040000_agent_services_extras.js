/// <reference path="../pb_data/types.d.ts" />
/**
 * Document agent invoice extras on ops_hub.extras (JSON already exists).
 * Shape: { agent_services: ServiceLineItem[], final_approved_price?: number|null }
 * No schema change required — ensures extras field remains present.
 */
migrate((app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    if (!hub.fields.getByName("extras")) {
      hub.fields.add(
        new Field({
          type: "json",
          name: "extras",
          required: false,
        })
      );
      app.save(hub);
    }
  } catch (e) {
    console.log("[1791040000] ops_hub.extras:", e);
  }
}, (app) => {
  // Keep extras — used by other features; no down migration.
  void app;
});
