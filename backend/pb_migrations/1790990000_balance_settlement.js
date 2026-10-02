/// <reference path="../pb_data/types.d.ts" />
/**
 * Balance settlement: total_paid_eur + PARTIALLY_PAID on tour_payment_status.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_hub");

  if (!col.fields.getByName("total_paid_eur")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "total_paid_eur",
        required: false,
      })
    );
  }

  if (!col.fields.getByName("estimated_total_eur")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "estimated_total_eur",
        required: false,
      })
    );
  }

  const statusField = col.fields.getByName("tour_payment_status");
  if (statusField && statusField.type === "select") {
    const values = Array.isArray(statusField.values)
      ? [...statusField.values]
      : [];
    for (const v of ["UNPAID", "FEE_PAID", "PARTIALLY_PAID", "FULLY_PAID"]) {
      if (!values.includes(v)) values.push(v);
    }
    statusField.values = values;
  }

  app.save(col);

  // Seed total_paid_eur from fee when fee paid
  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    const feePaid = Boolean(row.get("concierge_fee_paid"));
    const feeAmt =
      Number(row.get("concierge_fee_amount") || 0) ||
      Number(row.get("deposit_amount") || 0) ||
      60;
    const totalPaid = Number(row.get("total_paid_eur") || 0);
    if (feePaid && !(totalPaid > 0)) {
      row.set("total_paid_eur", feeAmt);
      dirty = true;
    }
    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("ops_hub");
    for (const name of ["total_paid_eur", "estimated_total_eur"]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
