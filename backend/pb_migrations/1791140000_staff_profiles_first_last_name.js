/// <reference path="../pb_data/types.d.ts" />
/**
 * staff_profiles: first_name + last_name for guest privacy gate.
 * display_name stays as the combined back-compat field (synced on save in app).
 * Does not backfill/split existing names — Ops fixes multi-part names in the editor.
 */
migrate((app) => {
  const profiles = app.findCollectionByNameOrId("staff_profiles");

  const missing = (name) => {
    try {
      return !profiles.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  let changed = false;
  if (missing("first_name")) {
    profiles.fields.add(
      new Field({
        type: "text",
        name: "first_name",
        required: false,
        max: 100,
      })
    );
    changed = true;
  }
  if (missing("last_name")) {
    profiles.fields.add(
      new Field({
        type: "text",
        name: "last_name",
        required: false,
        max: 100,
      })
    );
    changed = true;
  }
  if (changed) app.save(profiles);
}, (app) => {
  try {
    const profiles = app.findCollectionByNameOrId("staff_profiles");
    for (const name of ["first_name", "last_name"]) {
      try {
        profiles.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(profiles);
  } catch (_) {
    /* ignore */
  }
});
