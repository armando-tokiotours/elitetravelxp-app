/// <reference path="../pb_data/types.d.ts" />
/**
 * Add concierge agent role + ops_hub assignment fields.
 * Direct (Silo 1) guests get an assigned agent; agencies stay under ops.
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const role = staff.fields.getByName("role");
    if (role && role.type === "select") {
      const values = Array.isArray(role.values) ? role.values.slice() : [];
      if (!values.includes("agent")) {
        values.push("agent");
        role.values = values;
        app.save(staff);
      }
    }
  } catch (_) {
    /* staff may not exist on fresh DBs that skip prior migrations oddly */
  }

  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }

  const addIfMissing = (field) => {
    if (!hub.fields.getByName(field.name)) {
      hub.fields.add(new Field(field));
    }
  };

  addIfMissing({
    type: "text",
    name: "assigned_agent_id",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "text",
    name: "assigned_agent",
    required: false,
    max: 200,
  });

  app.save(hub);
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const role = staff.fields.getByName("role");
    if (role && role.type === "select" && Array.isArray(role.values)) {
      role.values = role.values.filter((v) => v !== "agent");
      app.save(staff);
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    for (const name of ["assigned_agent_id", "assigned_agent"]) {
      const f = hub.fields.getByName(name);
      if (f) hub.fields.removeById(f.id);
    }
    app.save(hub);
  } catch (_) {
    /* ignore */
  }
});
