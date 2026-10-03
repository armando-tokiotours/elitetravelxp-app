/// <reference path="../pb_data/types.d.ts" />
/**
 * Fix staff.createRule for Google Workspace SSO.
 *
 * PocketBase semantics:
 *   null  → only superusers can create  (blocks OAuth first-login)
 *   ""    → public create allowed       (OAuth can mint staff; hook assigns role)
 *
 * Earlier migrations incorrectly set createRule = null.
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    staff.createRule = "";
    app.save(staff);
    console.log("[1791090000] staff.createRule set to public empty string for OAuth");
  } catch (e) {
    console.log("[1791090000] staff createRule fix:", e);
  }
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    staff.createRule = null;
    app.save(staff);
  } catch (_) {
    /* ignore */
  }
});
