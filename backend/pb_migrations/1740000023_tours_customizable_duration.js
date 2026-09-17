/// <reference path="../pb_data/types.d.ts" />
/** Tailor-made tours: optional guest-defined duration (UI in a later release). */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  // getByName returns null/undefined when missing (does not always throw).
  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("is_customizable_duration")) {
    tours.fields.add(
      new Field({
        type: "bool",
        name: "is_customizable_duration",
        required: false,
      })
    );
  }

  app.save(tours);
}, (app) => {
  /* keep field on down — safe additive */
});
