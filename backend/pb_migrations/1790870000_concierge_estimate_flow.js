/// <reference path="../pb_data/types.d.ts" />
/**
 * Concierge estimate / €60 fee flow:
 * - site_branding copy keys (admin-editable)
 * - ops_hub: concierge_fee_paid, followup_date, deposit_amount
 * - booking_logs: concierge_fee_paid action
 */
migrate((app) => {
  const addText = (colName, name, max) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      try {
        col.fields.getByName(name);
        return;
      } catch (_) {}
      col.fields.add(
        new Field({
          type: "text",
          name,
          required: false,
          max: max || 2000,
        })
      );
      app.save(col);
    } catch (_) {}
  };

  const addNum = (colName, name) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      try {
        col.fields.getByName(name);
        return;
      } catch (_) {}
      col.fields.add(
        new Field({
          type: "number",
          name,
          required: false,
        })
      );
      app.save(col);
    } catch (_) {}
  };

  const addBool = (colName, name) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      try {
        col.fields.getByName(name);
        return;
      } catch (_) {}
      col.fields.add(
        new Field({
          type: "bool",
          name,
          required: false,
        })
      );
      app.save(col);
    } catch (_) {}
  };

  const addDate = (colName, name) => {
    try {
      const col = app.findCollectionByNameOrId(colName);
      try {
        col.fields.getByName(name);
        return;
      } catch (_) {}
      col.fields.add(
        new Field({
          type: "date",
          name,
          required: false,
        })
      );
      app.save(col);
    } catch (_) {}
  };

  addText("site_branding", "estimate_modal_title", 200);
  addText("site_branding", "estimate_per_day_subtext", 500);
  addText("site_branding", "concierge_fee_amount", 32);
  addText("site_branding", "concierge_fee_policy_text", 4000);
  addText("site_branding", "revolut_payment_url", 500);
  addText("site_branding", "estimate_opt_full_title", 200);
  addText("site_branding", "estimate_opt_full_sub", 500);
  addText("site_branding", "estimate_opt_partial_title", 200);
  addText("site_branding", "estimate_opt_partial_sub", 500);
  addText("site_branding", "estimate_opt_later_title", 200);
  addText("site_branding", "estimate_opt_later_sub", 500);
  addText("site_branding", "concierge_fee_modal_title", 200);

  addBool("ops_hub", "concierge_fee_paid");
  addDate("ops_hub", "followup_date");
  addNum("ops_hub", "deposit_amount");

  try {
    const logs = app.findCollectionByNameOrId("booking_logs");
    const action = logs.fields.getByName("action_type");
    if (action && action.type === "select") {
      const values = Array.isArray(action.values) ? [...action.values] : [];
      if (!values.includes("concierge_fee_paid")) {
        values.push("concierge_fee_paid");
        action.values = values;
        app.save(logs);
      }
    }
  } catch (_) {}
}, (app) => {
  void app;
});
