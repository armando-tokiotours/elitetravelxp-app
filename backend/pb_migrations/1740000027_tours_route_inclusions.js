/// <reference path="../pb_data/types.d.ts" />
/** Tours: route + inclusions/exclusions for client cards & CSV sync. */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("route")) {
    tours.fields.add(
      new Field({
        type: "text",
        name: "route",
        required: false,
        max: 5000,
      })
    );
  }
  if (missing("inclusions_exclusions")) {
    tours.fields.add(
      new Field({
        type: "text",
        name: "inclusions_exclusions",
        required: false,
        max: 8000,
      })
    );
  }

  app.save(tours);
}, (app) => {
  /* keep fields on down */
});
