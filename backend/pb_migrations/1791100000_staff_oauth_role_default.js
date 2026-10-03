/// <reference path="../pb_data/types.d.ts" />
/**
 * Make staff.role optional so Google OAuth signup can create the record
 * before the provisioning hook assigns the final role.
 * Seed core Workspace emails if missing (OAuth links on first login).
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const roleField = staff.fields.getByName("role");
    if (roleField) {
      roleField.required = false;
    }
    staff.createRule = "";
    app.save(staff);
    console.log("[1791100000] staff.role optional for OAuth create");
  } catch (e) {
    console.log("[1791100000] role optional:", e);
  }

  const seeds = [
    ["armando@tokiotours.nl", "owner", "Armando"],
    ["management@tokiotours.nl", "owner", "Management"],
    ["ivonne@tokiotours.nl", "accounting", "Ivonne"],
    ["melissa@tokiotours.nl", "ops", "Melissa"],
    ["vip@tokiotours.nl", "agent", "VIP"],
  ];

  const staffCol = app.findCollectionByNameOrId("staff");
  for (const [email, role, name] of seeds) {
    try {
      try {
        app.findFirstRecordByData("staff", "email", email);
        continue;
      } catch (_) {
        /* create */
      }
      const pass =
        "OauthSeed-" +
        email.replace(/[^a-z0-9]/gi, "") +
        "-" +
        Date.now().toString(36);
      const rec = new Record(staffCol, {
        email,
        name,
        role,
        account_type: "STAFF",
        active: true,
        verified: true,
        password: pass,
        passwordConfirm: pass,
      });
      app.save(rec);
      console.log("[1791100000] seeded staff", email, role);
    } catch (e) {
      console.log("[1791100000] seed", email, e);
    }
  }
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const roleField = staff.fields.getByName("role");
    if (roleField) roleField.required = true;
    app.save(staff);
  } catch (_) {
    /* ignore */
  }
});
