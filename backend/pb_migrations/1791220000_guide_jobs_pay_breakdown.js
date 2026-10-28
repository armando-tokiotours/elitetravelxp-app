/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_jobs pay breakdown:
 * base_pay_jpy + expenses_jpy + specialty_bonus_jpy = payout_jpy
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("guide_jobs");
    const add = (name) => {
      if (col.fields.getByName(name)) return;
      col.fields.add(
        new Field({
          type: "number",
          name,
          required: false,
          min: 0,
        })
      );
    };
    add("base_pay_jpy");
    add("expenses_jpy");
    add("specialty_bonus_jpy");
    app.save(col);
    console.log("[1791220000] guide_jobs pay breakdown fields ready");
  } catch (e) {
    console.log("[1791220000] guide_jobs pay breakdown:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("guide_jobs");
    for (const name of ["base_pay_jpy", "expenses_jpy", "specialty_bonus_jpy"]) {
      if (col.fields.getByName(name)) col.fields.removeByName(name);
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
