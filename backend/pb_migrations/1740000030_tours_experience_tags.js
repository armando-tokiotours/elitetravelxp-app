/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours/activities: 3-tag matcher fields for Experience Profiler.
 * vibe_tags (1–2) · pace_tag · is_niche
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

  let dirty = false;

  if (missing("vibe_tags")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "vibe_tags",
        required: false,
        maxSelect: 2,
        values: ["culture", "foodie", "modern", "nature"],
      })
    );
    dirty = true;
  }

  if (missing("pace_tag")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "pace_tag",
        required: false,
        maxSelect: 1,
        values: ["relaxed", "standard", "active"],
      })
    );
    dirty = true;
  }

  if (missing("is_niche")) {
    tours.fields.add(
      new Field({
        type: "bool",
        name: "is_niche",
        required: false,
      })
    );
    dirty = true;
  }

  if (dirty) app.save(tours);
}, (app) => {
  /* keep fields on down */
});
