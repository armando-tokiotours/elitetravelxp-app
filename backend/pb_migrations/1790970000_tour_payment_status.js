/// <reference path="../pb_data/types.d.ts" />
/**
 * Disambiguate Concierge Fee vs Full Tour Pay on ops_hub:
 * - tour_payment_status: UNPAID | FEE_PAID | FULLY_PAID
 * - concierge_fee_amount (number)
 * Repair: fee paid must not leave payment_confirmed true unless FULLY_PAID.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_hub");

  try {
    col.fields.getByName("tour_payment_status");
  } catch (_) {
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

  try {
    col.fields.getByName("concierge_fee_amount");
  } catch (_) {
    col.fields.add(
      new Field({
        type: "number",
        name: "concierge_fee_amount",
        required: false,
      })
    );
  }

  app.save(col);

  const rows = app.findAllRecords(col);
  for (const row of rows) {
    let dirty = false;
    const feePaid = Boolean(row.get("concierge_fee_paid"));
    const payConfirmed = Boolean(row.get("payment_confirmed"));
    const deposit = Number(row.get("deposit_amount") || 0);
    const feeAmt = Number(row.get("concierge_fee_amount") || 0);
    const status = String(row.get("tour_payment_status") || "").trim();

    if (feePaid && !feeAmt && deposit > 0) {
      row.set("concierge_fee_amount", deposit);
      dirty = true;
    } else if (feePaid && !feeAmt) {
      row.set("concierge_fee_amount", 60);
      dirty = true;
    }

    // Spec repair: fee paid + payment_confirmed wrongly set for deposit-only
    if (feePaid && payConfirmed && !status) {
      const amt = feeAmt || deposit || 60;
      if (amt > 0 && amt <= 100) {
        row.set("payment_confirmed", false);
        row.set("tour_payment_status", "FEE_PAID");
        dirty = true;
      } else if (payConfirmed) {
        row.set("tour_payment_status", "FULLY_PAID");
        dirty = true;
      }
    } else if (!status) {
      if (payConfirmed) {
        row.set("tour_payment_status", "FULLY_PAID");
        dirty = true;
      } else if (feePaid) {
        row.set("tour_payment_status", "FEE_PAID");
        dirty = true;
      } else {
        row.set("tour_payment_status", "UNPAID");
        dirty = true;
      }
    }

    if (dirty) app.save(row);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("ops_hub");
    for (const name of ["tour_payment_status", "concierge_fee_amount"]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {}
    }
    app.save(col);
  } catch (_) {}
});
