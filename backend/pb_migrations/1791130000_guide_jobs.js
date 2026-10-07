/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_jobs — per-tour / per-day guide dispatch (not whole-PNR).
 * Ops assigns Guide A to Day 1 Kyoto and posts Day 2 to the open board.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("guide_jobs");
    console.log("[1791130000] guide_jobs already exists");
    return;
  } catch (_) {
    /* create */
  }

  let guidesId = "";
  try {
    guidesId = app.findCollectionByNameOrId("guides").id;
  } catch (_) {
    guidesId = "";
  }

  const fields = [
    { name: "pnr", type: "text", required: true, max: 32 },
    {
      name: "job_key",
      type: "text",
      required: true,
      max: 200,
    },
    { name: "tour_date", type: "date", required: false },
    { name: "tour_name", type: "text", required: true, max: 300 },
    { name: "city", type: "text", required: false, max: 120 },
    { name: "tour_id", type: "text", required: false, max: 64 },
    { name: "service_line_id", type: "text", required: false, max: 80 },
    { name: "duration_hours", type: "number", required: false, min: 0 },
    { name: "pax_count", type: "number", required: false, min: 1 },
    { name: "payout_jpy", type: "number", required: false, min: 0 },
    {
      name: "status",
      type: "select",
      required: true,
      maxSelect: 1,
      values: [
        "UNASSIGNED",
        "OPEN_BOARD",
        "OFFERED",
        "ACCEPTED",
        "REJECTED",
        "COMPLETED",
      ],
    },
    {
      name: "assigned_guide_staff_id",
      type: "text",
      required: false,
      max: 64,
    },
    {
      name: "assigned_guide_name",
      type: "text",
      required: false,
      max: 200,
    },
    { name: "day_index", type: "number", required: false, min: 0 },
    { name: "notes", type: "text", required: false, max: 1000 },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  if (guidesId) {
    fields.splice(12, 0, {
      name: "assigned_guide",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: guidesId,
      cascadeDelete: false,
    });
  }

  const col = new Collection({
    type: "base",
    name: "guide_jobs",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields,
    indexes: [
      "CREATE UNIQUE INDEX idx_guide_jobs_key ON guide_jobs (`job_key`)",
      "CREATE INDEX idx_guide_jobs_pnr ON guide_jobs (`pnr`)",
      "CREATE INDEX idx_guide_jobs_staff ON guide_jobs (`assigned_guide_staff_id`)",
      "CREATE INDEX idx_guide_jobs_status ON guide_jobs (`status`)",
      "CREATE INDEX idx_guide_jobs_date ON guide_jobs (`tour_date`)",
    ],
  });
  app.save(col);
  console.log("[1791130000] guide_jobs created");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("guide_jobs"));
  } catch (_) {
    /* keep */
  }
});
