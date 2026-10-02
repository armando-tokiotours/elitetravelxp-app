/// <reference path="../pb_data/types.d.ts" />
/**
 * Fee ≠ full tour pay: clear payment_confirmed when only the small
 * concierge deposit was stamped as "paid" (legacy bug).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_hub");
  const rows = app.findAllRecords(col);
  for (const row of rows) {
    const feePaid = Boolean(row.get("concierge_fee_paid"));
    const payConfirmed = Boolean(row.get("payment_confirmed"));
    const deposit = Number(row.get("deposit_amount") || 0);
    if (feePaid && payConfirmed && deposit > 0 && deposit <= 100) {
      row.set("payment_confirmed", false);
      app.save(row);
    }
  }
}, (app) => {
  // irreversible data repair — no-op down
  void app;
});
