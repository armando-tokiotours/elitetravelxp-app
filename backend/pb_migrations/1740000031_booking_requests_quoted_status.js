/// <reference path="../pb_data/types.d.ts" />
/**
 * Add `quoted` status for print/PDF save requests (no deposit yet).
 * Ensure contact_email can be filtered with reference for retrieval APIs.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("booking_requests");
  const status = col.fields.getByName("status");
  if (status && status.type === "select") {
    const values = status.values || [];
    if (!values.includes("quoted")) {
      status.values = [...values, "quoted"];
    }
  }
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("booking_requests");
  const status = col.fields.getByName("status");
  if (status && status.type === "select") {
    status.values = (status.values || []).filter((v) => v !== "quoted");
  }
  app.save(col);
});
