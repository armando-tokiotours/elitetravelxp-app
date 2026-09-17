/// <reference path="../pb_data/types.d.ts" />
/**
 * Add contact_phone on booking_requests for Revolut checkout contact capture.
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("booking_requests");
  } catch (_) {
    return;
  }

  try {
    if (col.fields.getByName("contact_phone")) return;
  } catch (_) {
    /* add below */
  }

  col.fields.add(
    new Field({
      type: "text",
      name: "contact_phone",
      required: false,
      max: 40,
    })
  );
  app.save(col);
}, (app) => {
  /* keep field on down */
});
