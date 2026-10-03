/// <reference path="../pb_data/types.d.ts" />
/**
 * Add `accounting` to staff.role + guide onboarding token fields.
 * Soften staff createRule so Workspace SSO can mint pre-mapped staff accounts
 * (hook still rejects non-domain emails).
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const roleField = staff.fields.getByName("role");
    if (roleField && roleField.values) {
      const values = [...roleField.values];
      if (!values.includes("accounting")) {
        values.push("accounting");
        roleField.values = values;
      }
    }
    // Public create for OAuth2 first-login (empty string). null = superusers-only.
    staff.createRule = "";
    app.save(staff);
  } catch (e) {
    console.log("[1791060000] staff accounting role:", e);
  }

  try {
    const guides = app.findCollectionByNameOrId("guides");
    const ensure = (name, def) => {
      if (guides.fields.getByName(name)) return;
      guides.fields.add(new Field(def));
    };
    ensure("line_id", {
      type: "text",
      name: "line_id",
      required: false,
      max: 120,
    });
    ensure("onboarding_token", {
      type: "text",
      name: "onboarding_token",
      required: false,
      max: 120,
    });
    ensure("onboarding_token_expires", {
      type: "date",
      name: "onboarding_token_expires",
      required: false,
    });
    ensure("onboarding_complete", {
      type: "bool",
      name: "onboarding_complete",
      required: false,
    });
    ensure("emergency_contact", {
      type: "text",
      name: "emergency_contact",
      required: false,
      max: 200,
    });
    app.save(guides);
  } catch (e) {
    console.log("[1791060000] guides onboarding fields:", e);
  }
}, (app) => {
  try {
    const guides = app.findCollectionByNameOrId("guides");
    for (const name of [
      "line_id",
      "onboarding_token",
      "onboarding_token_expires",
      "onboarding_complete",
      "emergency_contact",
    ]) {
      try {
        guides.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(guides);
  } catch (_) {
    /* ignore */
  }
});
