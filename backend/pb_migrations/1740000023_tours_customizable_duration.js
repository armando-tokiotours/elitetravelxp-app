/// <reference path="../pb_data/types.d.ts" />
/** Tailor-made tours: optional guest-defined duration (UI in a later release). */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const has = (name) => {
    try {
      tours.fields.getByName(name);
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!has("is_customizable_duration")) {
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
