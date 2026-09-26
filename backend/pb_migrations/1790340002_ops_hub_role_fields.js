/// <reference path="../pb_data/types.d.ts" />
/**
 * Ops hub fields for assign / tickets / money (owner-visible costs).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }

  const addIfMissing = (field) => {
    if (!col.fields.getByName(field.name)) {
      col.fields.add(new Field(field));
    }
  };

  addIfMissing({
    type: "text",
    name: "assigned_guide_id",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "text",
    name: "assigned_driver_id",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "text",
    name: "assigned_ticketer_id",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "select",
    name: "ticket_status",
    required: false,
    maxSelect: 1,
    values: ["none", "needed", "ordered", "done"],
  });
  addIfMissing({
    type: "text",
    name: "ticket_notes",
    required: false,
    max: 5000,
  });
  addIfMissing({
    type: "number",
    name: "guide_pay_jpy",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "number",
    name: "driver_pay_jpy",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "number",
    name: "ticket_cost_jpy",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "number",
    name: "tour_count",
    required: false,
    min: 0,
  });

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("ops_hub");
    for (const name of [
      "assigned_guide_id",
      "assigned_driver_id",
      "assigned_ticketer_id",
      "ticket_status",
      "ticket_notes",
      "guide_pay_jpy",
      "driver_pay_jpy",
      "ticket_cost_jpy",
      "tour_count",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
