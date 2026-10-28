/// <reference path="../pb_data/types.d.ts" />
/**
 * staff.force_password_change — contractors created with a temp password
 * must reset before using guide/driver/agency/ticketer portals.
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    if (!staff.fields.getByName("force_password_change")) {
      staff.fields.add(
        new Field({
          type: "bool",
          name: "force_password_change",
          required: false,
        })
      );
      app.save(staff);
      console.log("[1791190000] staff.force_password_change ready");
    }
  } catch (e) {
    console.log("[1791190000] staff.force_password_change:", e);
  }
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    try {
      staff.fields.removeByName("force_password_change");
    } catch (_) {
      /* ignore */
    }
    app.save(staff);
  } catch (_) {
    /* ignore */
  }
});
