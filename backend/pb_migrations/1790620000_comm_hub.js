/// <reference path="../pb_data/types.d.ts" />
/**
 * Comm hub — guest ↔ assigned agent messaging by PNR.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("comm_threads");
  } catch (_) {
    const threads = new Collection({
      type: "base",
      name: "comm_threads",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        { name: "agent_id", type: "text", required: false, max: 64 },
        { name: "agent_name", type: "text", required: false, max: 200 },
        { name: "guest_email", type: "email", required: false },
        { name: "status", type: "select", required: false, maxSelect: 1, values: ["open", "closed"] },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_comm_threads_pnr ON comm_threads (`pnr`)",
      ],
    });
    app.save(threads);
  }

  try {
    app.findCollectionByNameOrId("comm_messages");
  } catch (_) {
    const messages = new Collection({
      type: "base",
      name: "comm_messages",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: null,
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "thread_id", type: "text", required: true, max: 64 },
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "author_role",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["guest", "agent", "ops"],
        },
        { name: "author_name", type: "text", required: false, max: 200 },
        { name: "body", type: "text", required: true, max: 4000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_comm_messages_thread ON comm_messages (`thread_id`)",
        "CREATE INDEX idx_comm_messages_pnr ON comm_messages (`pnr`)",
      ],
    });
    app.save(messages);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("comm_messages"));
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId("comm_threads"));
  } catch (_) {}
});
