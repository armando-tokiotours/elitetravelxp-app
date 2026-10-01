/// <reference path="../pb_data/types.d.ts" />
/**
 * Ops hub: is_read flag for inbox unread tracking.
 * New/unread rows stay false until an operator opens the inquiry.
 */
migrate((app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    if (!hub.fields.getByName("is_read")) {
      hub.fields.add(
        new Field({
          type: "bool",
          name: "is_read",
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
      hub.fields.removeByName("is_read");
      app.save(hub);
    } catch (_) {}
  } catch (_) {}
});
