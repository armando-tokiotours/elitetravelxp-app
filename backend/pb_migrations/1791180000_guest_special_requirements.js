/// <reference path="../pb_data/types.d.ts" />
/**
 * Dietary / mobility / extras / custom notes JSON on bookings + bookings_and_leads.
 * Shape: { dietaryTags, mobilityTags, extrasTags, customNotes }
 */
migrate((app) => {
  const addJson = (collectionName) => {
    try {
      const col = app.findCollectionByNameOrId(collectionName);
      if (!col.fields.getByName("guest_special_requirements")) {
        col.fields.add(
          new Field({
            type: "json",
            name: "guest_special_requirements",
            required: false,
          })
        );
        app.save(col);
      }
    } catch (e) {
      console.log(
        "[1791180000] guest_special_requirements on " + collectionName + ":",
        e
      );
    }
  };
  addJson("bookings");
  addJson("bookings_and_leads");
}, (app) => {
  for (const name of ["bookings", "bookings_and_leads"]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col.fields.getByName("guest_special_requirements")) {
        col.fields.removeByName("guest_special_requirements");
        app.save(col);
      }
    } catch (_) {}
  }
});
