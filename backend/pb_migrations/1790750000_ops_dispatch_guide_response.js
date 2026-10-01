/// <reference path="../pb_data/types.d.ts" />
/**
 * guide_response on ops_dispatch — pending | accepted | refused | none
 * Keeps guide_mode on legacy select values (unassigned/direct/open/claimed)
 * so Send-to-guide works without invalid select errors.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_dispatch");
  let dirty = false;
  try {
    if (!col.fields.getByName("guide_response")) {
      col.fields.add(
        new Field({
          type: "select",
          name: "guide_response",
          required: false,
          maxSelect: 1,
          values: ["none", "pending", "accepted", "refused"],
        })
      );
      dirty = true;
    }
  } catch (_) {
    col.fields.add(
      new Field({
        type: "select",
        name: "guide_response",
        required: false,
        maxSelect: 1,
        values: ["none", "pending", "accepted", "refused"],
      })
    );
    dirty = true;
  }

  // Re-assert legacy guide_mode values only (safe on VPS that never got 179073)
  try {
    const gm = col.fields.getByName("guide_mode");
    if (gm) {
      gm.values = ["unassigned", "direct", "open", "claimed"];
      dirty = true;
    }
  } catch (_) {
    /* ignore */
  }

  if (dirty) app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("ops_dispatch");
  try {
    const f = col.fields.getByName("guide_response");
    if (f) {
      col.fields.removeById(f.id);
      app.save(col);
    }
  } catch (_) {
    /* ignore */
  }
});
