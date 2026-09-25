/// <reference path="../pb_data/types.d.ts" />
/**
 * Cities: available_languages multi-select for Builder language dropdown.
 */
migrate((app) => {
  const cities = app.findCollectionByNameOrId("cities");

  const missing = (name) => {
    try {
      return !cities.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("available_languages")) {
    cities.fields.add(
      new Field({
        type: "select",
        name: "available_languages",
        required: false,
        maxSelect: 10,
        values: [
          "English",
          "Japanese",
          "French",
          "German",
          "Spanish",
          "Italian",
          "Dutch",
          "Portuguese",
          "Chinese",
          "Korean",
        ],
      })
    );
    app.save(cities);
  }

  // Default Tokyo / major cities to a sensible set when empty
  const rows = app.findAllRecords(cities);
  const defaults = [
    "English",
    "Dutch",
    "Japanese",
    "French",
    "German",
    "Spanish",
    "Italian",
  ];
  for (const row of rows) {
    const existing = row.get("available_languages");
    const empty =
      !existing ||
      (Array.isArray(existing) && existing.length === 0) ||
      (typeof existing === "string" && !String(existing).trim());
    if (empty) {
      row.set("available_languages", defaults);
      app.save(row);
    }
  }
}, (app) => {
  /* keep field */
});
