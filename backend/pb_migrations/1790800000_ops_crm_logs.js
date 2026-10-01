/// <reference path="../pb_data/types.d.ts" />
/**
 * Ops CRM: last-action fields on ops_hub + booking_logs audit trail.
 * Also adds end_date so Post-Tour filtering can run without joining Silo 1.
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

    if (!has("last_action_by")) {
      hub.fields.add(
        new Field({
          type: "text",
          name: "last_action_by",
          required: false,
          max: 64,
        })
      );
    }
    if (!has("last_action_date")) {
      hub.fields.add(
        new Field({
          type: "date",
          name: "last_action_date",
          required: false,
        })
      );
    }
    if (!has("end_date")) {
      hub.fields.add(
        new Field({
          type: "date",
          name: "end_date",
          required: false,
        })
      );
    }
    app.save(hub);
  } catch (_) {}

  try {
    app.findCollectionByNameOrId("booking_logs");
    return;
  } catch (_) {
    /* create below */
  }

  const logs = new Collection({
    type: "base",
    name: "booking_logs",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "pnr", type: "text", required: true, max: 32 },
      { name: "ops_hub_id", type: "text", required: false, max: 64 },
      { name: "staff_id", type: "text", required: false, max: 64 },
      { name: "staff_name", type: "text", required: false, max: 200 },
      {
        name: "action_type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: [
          "opened",
          "guide_assigned",
          "payment_sent",
          "tickets_booked",
          "note_added",
          "status_changed",
          "guest_update",
        ],
      },
      { name: "details", type: "text", required: false, max: 2000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_booking_logs_pnr ON booking_logs (`pnr`)",
      "CREATE INDEX idx_booking_logs_hub ON booking_logs (`ops_hub_id`)",
      "CREATE INDEX idx_booking_logs_action ON booking_logs (`action_type`)",
    ],
  });
  app.save(logs);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("booking_logs"));
  } catch (_) {}
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    for (const name of ["last_action_by", "last_action_date", "end_date"]) {
      try {
        hub.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(hub);
  } catch (_) {}
});
