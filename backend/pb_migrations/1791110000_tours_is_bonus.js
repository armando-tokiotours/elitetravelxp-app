/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours: is_bonus — agent-only catalog gift items.
 * Hidden from guest builders until Ops adds them to a package.
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("is_bonus")) {
    tours.fields.add(
      new Field({
        type: "bool",
        name: "is_bonus",
        required: false,
      })
    );
    app.save(tours);
  }
}, (app) => {
  /* keep field on down */
});
