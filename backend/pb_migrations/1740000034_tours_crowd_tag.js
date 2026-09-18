/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours: crowd_tag for profiler matching
 * hidden_gem | classic_highlight | balanced_mix
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  try {
    if (tours.fields.getByName("crowd_tag")) return;
  } catch (_) {
    /* add below */
  }

  tours.fields.add(
    new Field({
      type: "select",
      name: "crowd_tag",
      required: false,
      maxSelect: 1,
      values: ["hidden_gem", "classic_highlight", "balanced_mix"],
    })
  );
  app.save(tours);
}, (app) => {
  /* keep field on down */
});
