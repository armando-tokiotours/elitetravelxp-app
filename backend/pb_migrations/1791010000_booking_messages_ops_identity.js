/// <reference path="../pb_data/types.d.ts" />
/**
 * Internal OPS agent identity:
 * - SUPER_USER / OPS_COORDINATOR sender roles
 * - optional target_agent_* so internal notes stay on the assigned concierge thread
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("booking_messages");

  const senderRole = col.fields.getByName("sender_role");
  if (senderRole && Array.isArray(senderRole.values)) {
    const next = [...senderRole.values];
    for (const v of ["SUPER_USER", "OPS_COORDINATOR"]) {
      if (!next.includes(v)) next.push(v);
    }
    senderRole.values = next;
  }

  if (!col.fields.getByName("target_agent_id")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "target_agent_id",
        required: false,
        max: 64,
      })
    );
  }
  if (!col.fields.getByName("target_agent_email")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "target_agent_email",
        required: false,
        max: 200,
      })
    );
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("booking_messages");
    const senderRole = col.fields.getByName("sender_role");
    if (senderRole && Array.isArray(senderRole.values)) {
      senderRole.values = senderRole.values.filter(
        (v) => v !== "SUPER_USER" && v !== "OPS_COORDINATOR"
      );
    }
    const idField = col.fields.getByName("target_agent_id");
    if (idField) col.fields.removeById(idField.id);
    const emailField = col.fields.getByName("target_agent_email");
    if (emailField) col.fields.removeById(emailField.id);
    app.save(col);
  } catch (_) {}
});
