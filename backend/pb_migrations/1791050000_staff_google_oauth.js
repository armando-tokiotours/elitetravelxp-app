/// <reference path="../pb_data/types.d.ts" />
/**
 * Enable Google OAuth2 scaffolding on the staff auth collection.
 * Client ID / Secret are injected at runtime from env (see configure_google_oauth.pb.js).
 * Never commit real secrets into migrations.
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    // Keep createRule empty so OAuth cannot mint random staff accounts —
    // only pre-provisioned / linked staff emails can authenticate.
    if (!staff.oauth2) {
      staff.oauth2 = {
        enabled: true,
        mappedFields: { name: "name" },
        providers: [],
      };
    } else {
      staff.oauth2.enabled = true;
      if (!staff.oauth2.mappedFields) {
        staff.oauth2.mappedFields = { name: "name" };
      }
    }
    app.save(staff);
    console.log("[1791050000] staff.oauth2 enabled (providers set from env at bootstrap)");
  } catch (e) {
    console.log("[1791050000] staff oauth2:", e);
  }
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    if (staff.oauth2) {
      staff.oauth2.enabled = false;
      app.save(staff);
    }
  } catch (_) {
    /* ignore */
  }
});
