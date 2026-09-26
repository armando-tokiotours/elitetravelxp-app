/// <reference path="../pb_data/types.d.ts" />
/**
 * Thin ops_hub: drop fields migrated to ops_dispatch / ops_money / ops_tickets.
 * Keeps index + agent + pickup/special fields.
 */
migrate((app) => {
  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }

  const drop = [
    "assigned_guide_id",
    "assigned_guide",
    "assigned_driver_id",
    "assigned_driver",
    "assigned_ticketer_id",
    "ticket_status",
    "ticket_notes",
    "guide_pay_jpy",
    "driver_pay_jpy",
    "ticket_cost_jpy",
    "tour_count",
  ];

  for (const name of drop) {
    const f = hub.fields.getByName(name);
    if (f) hub.fields.removeById(f.id);
  }
  app.save(hub);
}, (app) => {
  // Re-add is intentionally empty — restore from earlier migrations if needed.
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    const addIfMissing = (field) => {
      if (!hub.fields.getByName(field.name)) {
        hub.fields.add(new Field(field));
      }
    };
    addIfMissing({ type: "text", name: "assigned_guide_id", required: false, max: 64 });
    addIfMissing({ type: "text", name: "assigned_guide", required: false, max: 200 });
    addIfMissing({ type: "text", name: "assigned_driver_id", required: false, max: 64 });
    addIfMissing({ type: "text", name: "assigned_driver", required: false, max: 200 });
    addIfMissing({ type: "text", name: "assigned_ticketer_id", required: false, max: 64 });
    addIfMissing({
      type: "select",
      name: "ticket_status",
      required: false,
      maxSelect: 1,
      values: ["none", "needed", "ordered", "done"],
    });
    addIfMissing({ type: "text", name: "ticket_notes", required: false, max: 5000 });
    addIfMissing({ type: "number", name: "guide_pay_jpy", required: false, min: 0 });
    addIfMissing({ type: "number", name: "driver_pay_jpy", required: false, min: 0 });
    addIfMissing({ type: "number", name: "ticket_cost_jpy", required: false, min: 0 });
    addIfMissing({ type: "number", name: "tour_count", required: false, min: 0 });
    app.save(hub);
  } catch (_) {
    /* ignore */
  }
});
