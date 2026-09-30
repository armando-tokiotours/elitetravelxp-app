/// <reference path="../pb_data/types.d.ts" />
/**
 * Ops hub: concierge payment_confirmed flag (accounting later).
 */
migrate((app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    if (!hub.fields.getByName("payment_confirmed")) {
      hub.fields.add(
        new Field({
          type: "bool",
          name: "payment_confirmed",
          required: false,
        })
      );
      app.save(hub);
    }
  } catch (_) {}
}, (app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    try {
      hub.fields.removeByName("payment_confirmed");
      app.save(hub);
    } catch (_) {}
  } catch (_) {}
});
