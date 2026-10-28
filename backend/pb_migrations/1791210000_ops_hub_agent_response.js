/// <reference path="../pb_data/types.d.ts" />
/**
 * agent_response on ops_hub — none | pending | accepted
 * Tracks concierge agent acceptance after assigned_agent_id is set.
 * Mirrors ops_dispatch.guide_response pattern (assign → pending; accept → accepted).
 */
migrate((app) => {
  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }

  if (!hub.fields.getByName("agent_response")) {
    hub.fields.add(
      new Field({
        type: "select",
        name: "agent_response",
        required: false,
        maxSelect: 1,
        values: ["none", "pending", "accepted"],
      })
    );
    app.save(hub);
  }
}, (app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    const f = hub.fields.getByName("agent_response");
    if (f) {
      hub.fields.removeById(f.id);
      app.save(hub);
    }
  } catch (_) {
    /* ignore */
  }
});
