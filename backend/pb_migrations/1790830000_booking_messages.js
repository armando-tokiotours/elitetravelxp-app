/// <reference path="../pb_data/types.d.ts" />
/**
 * PNR-bound multi-channel ops chat (Customer / Guide / Driver / Tickets).
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("booking_messages");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "booking_messages",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "pnr", type: "text", required: true, max: 32 },
      { name: "ops_hub_id", type: "text", required: false, max: 64 },
      {
        name: "channel",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["CUSTOMER", "GUIDE", "DRIVER", "TICKETS"],
      },
      { name: "sender_id", type: "text", required: false, max: 64 },
      { name: "sender_name", type: "text", required: false, max: 200 },
      {
        name: "sender_role",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["CONCIERGE", "CUSTOMER", "GUIDE", "DRIVER", "TICKETS"],
      },
      { name: "message", type: "text", required: true, max: 4000 },
      { name: "is_read", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_booking_messages_pnr ON booking_messages (`pnr`)",
      "CREATE INDEX idx_booking_messages_pnr_channel ON booking_messages (`pnr`, `channel`)",
    ],
  });
  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("booking_messages"));
  } catch (_) {}
});
