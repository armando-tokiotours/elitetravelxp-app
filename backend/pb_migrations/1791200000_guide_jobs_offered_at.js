/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_jobs.offered_at — when Ops offered a day job to a guide.
 * Used by /api/ops/expire-offers for the 48h accept timeout.
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("guide_jobs");
    if (col.fields.getByName("offered_at")) {
      console.log("[1791200000] offered_at already exists");
      return;
    }
    col.fields.add(
      new Field({
        type: "date",
        name: "offered_at",
        required: false,
      })
    );
    app.save(col);
    console.log("[1791200000] guide_jobs.offered_at added");
  } catch (e) {
    console.log("[1791200000] skip:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("guide_jobs");
    if (col.fields.getByName("offered_at")) {
      col.fields.removeByName("offered_at");
      app.save(col);
    }
  } catch (_) {
    /* keep */
  }
});
