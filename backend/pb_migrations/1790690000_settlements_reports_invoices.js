/// <reference path="../pb_data/types.d.ts" />
/**
 * Completion reports, monthly guide settlements, agency invoices, cancellation rules.
 */
migrate((app) => {
  let guidesId = "";
  let agenciesId = "";
  let assignmentsId = "";
  try {
    guidesId = app.findCollectionByNameOrId("guides").id;
    agenciesId = app.findCollectionByNameOrId("agencies").id;
    assignmentsId = app.findCollectionByNameOrId(
      "itinerary_guide_assignments"
    ).id;
  } catch (_) {
    return;
  }

  try {
    app.findCollectionByNameOrId("tour_completion_reports");
  } catch (_) {
    const reports = new Collection({
      type: "base",
      name: "tour_completion_reports",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "assignment",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: assignmentsId,
          cascadeDelete: true,
        },
        { name: "pnr", type: "text", required: true, max: 32 },
        {
          name: "actual_hours_worked",
          type: "number",
          required: true,
          min: 0,
        },
        { name: "extra_hours_approved", type: "bool", required: false },
        {
          name: "actual_expenses_jpy",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "receipts",
          type: "file",
          required: false,
          maxSelect: 10,
          maxSize: 10485760,
          mimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ],
        },
        { name: "guide_tour_notes", type: "text", required: false, max: 5000 },
        {
          name: "client_rating",
          type: "number",
          required: false,
          min: 1,
          max: 5,
        },
        { name: "is_verified_by_admin", type: "bool", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_tcr_assignment ON tour_completion_reports (`assignment`)",
        "CREATE INDEX idx_tcr_pnr ON tour_completion_reports (`pnr`)",
      ],
    });
    app.save(reports);
  }

  try {
    app.findCollectionByNameOrId("guide_monthly_settlements");
  } catch (_) {
    const settlements = new Collection({
      type: "base",
      name: "guide_monthly_settlements",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "guide",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: guidesId,
          cascadeDelete: false,
        },
        { name: "billing_period", type: "text", required: true, max: 16 },
        {
          name: "total_tours_completed",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "total_labor_fees",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "total_reimbursed_expenses",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "overtime_adjustments",
          type: "number",
          required: false,
        },
        {
          name: "tax_withholding_amount",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "final_net_payout",
          type: "number",
          required: true,
        },
        {
          name: "currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["EUR", "JPY"],
        },
        { name: "included_report_ids", type: "json", required: false },
        {
          name: "status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["draft", "approved", "processing", "paid"],
        },
        { name: "paid_at", type: "date", required: false },
        {
          name: "bank_payment_reference",
          type: "text",
          required: false,
          max: 200,
        },
        {
          name: "payout_statement_pdf",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ["application/pdf"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_gms_guide_period ON guide_monthly_settlements (`guide`, `billing_period`)",
      ],
    });
    app.save(settlements);
  }

  try {
    app.findCollectionByNameOrId("agency_monthly_invoices");
  } catch (_) {
    const invoices = new Collection({
      type: "base",
      name: "agency_monthly_invoices",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "agency",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: agenciesId,
          cascadeDelete: false,
        },
        { name: "invoice_number", type: "text", required: true, max: 64 },
        { name: "billing_period", type: "text", required: true, max: 16 },
        { name: "included_pnrs", type: "json", required: false },
        { name: "line_items", type: "json", required: false },
        {
          name: "subtotal_amount",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "agency_commission_deducted",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "total_amount_due",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["EUR", "JPY"],
        },
        { name: "issue_date", type: "date", required: false },
        { name: "due_date", type: "date", required: false },
        {
          name: "invoice_status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["draft", "sent", "partially_paid", "paid", "overdue"],
        },
        {
          name: "invoice_pdf",
          type: "file",
          required: false,
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ["application/pdf"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_ami_number ON agency_monthly_invoices (`invoice_number`)",
        "CREATE UNIQUE INDEX idx_ami_agency_period ON agency_monthly_invoices (`agency`, `billing_period`)",
      ],
    });
    app.save(invoices);
  }

  try {
    app.findCollectionByNameOrId("tour_cancellation_rules");
  } catch (_) {
    const rules = new Collection({
      type: "base",
      name: "tour_cancellation_rules",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "cancellation_timeframe",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["within_24h", "days_2_7", "days_8_plus"],
        },
        {
          name: "client_refund_percentage",
          type: "number",
          required: false,
          min: 0,
          max: 100,
        },
        {
          name: "guide_compensation_percentage",
          type: "number",
          required: false,
          min: 0,
          max: 100,
        },
        {
          name: "agency_penalty_percentage",
          type: "number",
          required: false,
          min: 0,
          max: 100,
        },
        {
          name: "applies_to",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["direct", "agency", "both"],
        },
        { name: "is_active", type: "bool", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_tcrules_timeframe ON tour_cancellation_rules (`cancellation_timeframe`)",
      ],
    });
    app.save(rules);

    const seeds = [
      {
        cancellation_timeframe: "within_24h",
        client_refund_percentage: 0,
        guide_compensation_percentage: 50,
        agency_penalty_percentage: 100,
        applies_to: "both",
        is_active: true,
      },
      {
        cancellation_timeframe: "days_2_7",
        client_refund_percentage: 50,
        guide_compensation_percentage: 25,
        agency_penalty_percentage: 50,
        applies_to: "both",
        is_active: true,
      },
      {
        cancellation_timeframe: "days_8_plus",
        client_refund_percentage: 100,
        guide_compensation_percentage: 0,
        agency_penalty_percentage: 0,
        applies_to: "both",
        is_active: true,
      },
    ];
    for (const s of seeds) {
      const rec = new Record(rules);
      for (const [k, v] of Object.entries(s)) rec.set(k, v);
      app.save(rec);
    }
  }
}, (app) => {
  for (const name of [
    "tour_cancellation_rules",
    "agency_monthly_invoices",
    "guide_monthly_settlements",
    "tour_completion_reports",
  ]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {}
  }
});
