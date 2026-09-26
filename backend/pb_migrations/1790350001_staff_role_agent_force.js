/// <reference path="../pb_data/types.d.ts" />
/**
 * Force-add `agent` to staff.role select values.
 * 1790350000 added ops_hub fields but select value mutation can no-op
 * depending on PocketBase field proxy dirty tracking.
 */
migrate((app) => {
  const staff = app.findCollectionByNameOrId("staff");
  const role = staff.fields.getByName("role");
  if (!role || role.type !== "select") return;

  const values = Array.isArray(role.values) ? [...role.values] : [];
  if (values.includes("agent")) return;

  // Prefer owner → ops → agent → …
  const opsIdx = values.indexOf("ops");
  if (opsIdx >= 0) {
    values.splice(opsIdx + 1, 0, "agent");
  } else {
    values.push("agent");
  }
  role.values = values;
  app.save(staff);
}, (app) => {
  try {
    const staff = app.findCollectionByNameOrId("staff");
    const role = staff.fields.getByName("role");
    if (role && role.type === "select" && Array.isArray(role.values)) {
      role.values = role.values.filter((v) => v !== "agent");
      app.save(staff);
    }
  } catch (_) {
    /* ignore */
  }
});
