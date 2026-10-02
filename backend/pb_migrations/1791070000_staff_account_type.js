/// <reference path="../pb_data/types.d.ts" />
/**
 * staff.account_type for flexible provisioning:
 * STAFF | GUIDE | TRAVEL_AGENT | PENDING
 */
migrate((app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    if (!staff.fields.getByName("account_type")) {
      staff.fields.add(
        new Field({
          type: "select",
          name: "account_type",
          required: false,
          maxSelect: 1,
          values: ["STAFF", "GUIDE", "TRAVEL_AGENT", "PENDING"],
        })
      );
    }
    const roleField = staff.fields.getByName("role");
    if (roleField && roleField.values && !roleField.values.includes("accounting")) {
      roleField.values = [...roleField.values, "accounting"];
    }
    // Allow OAuth / admin creates freely (provisioning hook assigns roles)
    try {
      staff.createRule = null;
    } catch (_) {
      staff.createRule = "";
    }
    app.save(staff);
    console.log("[1791070000] staff.account_type ready");
  } catch (e) {
    console.log("[1791070000] staff.account_type:", e);
  }
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    try {
      staff.fields.removeByName("account_type");
    } catch (_) {
      /* ignore */
    }
    app.save(staff);
  } catch (_) {
    /* ignore */
  }
});
