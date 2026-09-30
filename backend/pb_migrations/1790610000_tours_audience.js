/// <reference path="../pb_data/types.d.ts" />
/**
 * tours.audience — agency | individual | both (catalog visibility).
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("tours");
    try {
      col.fields.getByName("audience");
    } catch (_) {
      col.fields.add(
        new Field({
          name: "audience",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["agency", "individual", "both"],
        })
      );
      app.save(col);
    }
  } catch (_) {
    /* tours missing */
  }

  try {
    const eap = app.findCollectionByNameOrId("experiences_and_places");
    try {
      eap.fields.getByName("audience");
    } catch (_) {
      eap.fields.add(
        new Field({
          name: "audience",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["agency", "individual", "both"],
        })
      );
      app.save(eap);
    }
  } catch (_) {
    /* optional */
  }
}, (app) => {
  void app;
});
