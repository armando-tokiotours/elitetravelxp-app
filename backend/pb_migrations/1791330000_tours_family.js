/// <reference path="../pb_data/types.d.ts" />
/**
 * Tour families: one master product (e.g. "City Tour" in Tokyo) with
 * duration variants (4h / 6h / 8h) as slim linked rows.
 *   family_id        → id of the master tour record (master points to itself)
 *   is_family_master → true on the master row
 * Legacy rows keep family_id empty — the app auto-groups them by
 * (city + title-without-hours) until an admin saves them explicitly.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("tours");
  const has = (name) => {
    try {
      return Boolean(col.fields.getByName(name));
    } catch (_) {
      return false;
    }
  };

  if (!has("family_id")) {
    col.fields.add(
      new Field({
        type: "text",
        name: "family_id",
        required: false,
        max: 64,
      })
    );
  }
  if (!has("is_family_master")) {
    col.fields.add(
      new Field({
        type: "bool",
        name: "is_family_master",
        required: false,
      })
    );
  }
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("tours");
    col.fields.removeByName("family_id");
    col.fields.removeByName("is_family_master");
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
