/// <reference path="../pb_data/types.d.ts" />
/** Allow concierge vendor_role on dispatch tokens. */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("vendor_dispatch_tokens");
    const field = col.fields.getByName("vendor_role");
    if (field && field.type === "select") {
      const values = Array.isArray(field.values) ? [...field.values] : [];
      if (!values.includes("concierge")) {
        field.values = [...values, "concierge"];
        app.save(col);
      }
    }
  } catch (_) {}
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("vendor_dispatch_tokens");
    const field = col.fields.getByName("vendor_role");
    if (field && field.type === "select") {
      field.values = (field.values || []).filter((v) => v !== "concierge");
      app.save(col);
    }
  } catch (_) {}
});
