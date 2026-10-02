/// <reference path="../pb_data/types.d.ts" />
/**
 * Builder E — booking_type on `bookings` (EXPERIENCE_ONLY micro-services).
 */
migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (!bookings.fields.getByName("booking_type")) {
    bookings.fields.add(
      new Field({
        type: "select",
        name: "booking_type",
        required: false,
        maxSelect: 1,
        values: ["EXPERIENCE_ONLY", "MULTI_DAY", "SINGLE_DAY", "PRE_ELITE"],
      })
    );
    app.save(bookings);
  }
}, (app) => {
  try {
    const bookings = app.findCollectionByNameOrId("bookings");
    const f = bookings.fields.getByName("booking_type");
    if (f) {
      bookings.fields.removeById(f.id);
      app.save(bookings);
    }
  } catch (_) {}
});
