/// <reference path="../pb_data/types.d.ts" />
/**
 * Silo 3 pocket: ops_tickets — ticketer status/notes, keyed by PNR.
 * Backfills from ops_hub ticket_* / assigned_ticketer_id.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ops_tickets");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "ops_tickets",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "ticket_status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["none", "needed", "ordered", "done"],
        },
        { name: "ticket_notes", type: "text", required: false, max: 5000 },
        { name: "assigned_ticketer_id", type: "text", required: false, max: 64 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_ops_tickets_pnr ON ops_tickets (`pnr`)",
        "CREATE INDEX idx_ops_tickets_status ON ops_tickets (`ticket_status`)",
      ],
    });
    app.save(col);
  }

  let hub;
  try {
    hub = app.findCollectionByNameOrId("ops_hub");
  } catch (_) {
    return;
  }
  const tickets = app.findCollectionByNameOrId("ops_tickets");
  const rows = app.findRecordsByFilter(hub, "id != ''", "-created", 500, 0);
  for (const row of rows) {
    const pnr = String(row.get("pnr") || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    let existing = null;
    try {
      existing = app.findFirstRecordByFilter(
        tickets,
        `pnr="${pnr.replace(/"/g, "")}"`
      );
    } catch (_) {
      existing = null;
    }
    const status = String(row.get("ticket_status") || "none").trim() || "none";
    const fields = {
      pnr,
      ticket_status: ["none", "needed", "ordered", "done"].includes(status)
        ? status
        : "none",
      ticket_notes: String(row.get("ticket_notes") || ""),
      assigned_ticketer_id: String(row.get("assigned_ticketer_id") || "").trim(),
    };
    if (existing) {
      for (const [k, v] of Object.entries(fields)) existing.set(k, v);
      app.save(existing);
    } else {
      const rec = new Record(tickets);
      for (const [k, v] of Object.entries(fields)) rec.set(k, v);
      app.save(rec);
    }
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ops_tickets"));
  } catch (_) {
    /* ignore */
  }
});
