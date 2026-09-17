/// <reference path="../pb_data/types.d.ts" />
/** Multi-language flags for guided tours (Team Access + public cards). */
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

  if (missing("languages")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "languages",
        required: false,
        maxSelect: 10,
        values: [
          "English",
          "Dutch",
          "Spanish",
          "French",
          "German",
          "Italian",
          "Japanese",
          "Portuguese",
          "Chinese",
          "Korean",
        ],
      })
    );
  }

  app.save(tours);
}, (app) => {
  /* keep field on down — safe additive */
});
