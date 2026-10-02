/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-add fee vs tour-pay fields on ops_hub (prior migrations used
 * try/getByName/return which skipped adds when getByName returned null).
 * Then repair inverted records: payment_confirmed without concierge_fee_paid
 * when payments ledger shows concierge_deposit (e.g. JPN-XRFTG2).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_hub");

  if (!col.fields.getByName("concierge_fee_paid")) {
    col.fields.add(
      new Field({
        type: "bool",
        name: "concierge_fee_paid",
        required: false,
      })
    );
  }

  if (!col.fields.getByName("deposit_amount")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "deposit_amount",
        required: false,
      })
    );
  }

  if (!col.fields.getByName("concierge_fee_amount")) {
    col.fields.add(
      new Field({
        type: "number",
        name: "concierge_fee_amount",
        required: false,
      })
    );
  }

  if (!col.fields.getByName("tour_payment_status")) {
    col.fields.add(
      new Field({
        type: "select",
        name: "tour_payment_status",
        required: false,
        values: ["UNPAID", "FEE_PAID", "FULLY_PAID"],
        maxSelect: 1,
      })
    );
  }

  if (!col.fields.getByName("followup_date")) {
    col.fields.add(
      new Field({
        type: "date",
        name: "followup_date",
        required: false,
      })
    );
  }

  app.save(col);

  // Map PNR → concierge deposit amount from payments ledger
  const feeByPnr = {};
  try {
    const payCol = app.findCollectionByNameOrId("payments");
    const pays = app.findAllRecords(payCol);
    for (const p of pays) {
      const kind = String(p.get("kind") || "");
      const pnr = String(p.get("pnr") || "")
        .trim()
        .toUpperCase();
      if (!pnr) continue;
      if (kind === "concierge_deposit") {
        const amt = Number(p.get("amount_eur") || 60) || 60;
        feeByPnr[pnr] = amt;
      }
    }
  } catch (_) {}

  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    const pnr = String(row.get("pnr") || "")
      .trim()
      .toUpperCase();
    const payConfirmed = Boolean(row.get("payment_confirmed"));
    let feePaid = Boolean(row.get("concierge_fee_paid"));
    let deposit = Number(row.get("deposit_amount") || 0);
    let feeAmt = Number(row.get("concierge_fee_amount") || 0);
    let status = String(row.get("tour_payment_status") || "").trim();

    const ledgerFee = feeByPnr[pnr];

    // Inversion: tour pay Yes + fee no, but ledger (or small deposit) proves €60 fee
    if (payConfirmed && !feePaid) {
      if (ledgerFee || (deposit > 0 && deposit <= 100) || pnr === "JPN-XRFTG2") {
        const amt = ledgerFee || deposit || 60;
        row.set("concierge_fee_paid", true);
        row.set("concierge_fee_amount", amt);
        row.set("deposit_amount", amt);
        row.set("payment_confirmed", false);
        row.set("tour_payment_status", "FEE_PAID");
        dirty = true;
        feePaid = true;
        feeAmt = amt;
        deposit = amt;
        status = "FEE_PAID";
      }
    }

    // Both flags true with small deposit → fee only
    if (feePaid && payConfirmed && !dirty) {
      const amt = feeAmt || deposit || ledgerFee || 60;
      if (amt > 0 && amt <= 100) {
        row.set("payment_confirmed", false);
        row.set("tour_payment_status", "FEE_PAID");
        row.set("concierge_fee_amount", amt);
        row.set("deposit_amount", amt);
        dirty = true;
        status = "FEE_PAID";
      }
    }

    // Ledger says fee paid but flag missing
    if (!feePaid && ledgerFee) {
      row.set("concierge_fee_paid", true);
      row.set("concierge_fee_amount", ledgerFee);
      row.set("deposit_amount", ledgerFee);
      if (!payConfirmed) {
        row.set("tour_payment_status", "FEE_PAID");
        row.set("payment_confirmed", false);
      }
      dirty = true;
      feePaid = true;
      status = String(row.get("tour_payment_status") || "FEE_PAID");
    }

    if (!status) {
      if (Boolean(row.get("payment_confirmed"))) {
        row.set("tour_payment_status", "FULLY_PAID");
      } else if (Boolean(row.get("concierge_fee_paid"))) {
        row.set("tour_payment_status", "FEE_PAID");
      } else {
        row.set("tour_payment_status", "UNPAID");
      }
      dirty = true;
    }

    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("ops_hub");
    for (const name of [
      "concierge_fee_paid",
      "deposit_amount",
      "concierge_fee_amount",
      "tour_payment_status",
      "followup_date",
    ]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
