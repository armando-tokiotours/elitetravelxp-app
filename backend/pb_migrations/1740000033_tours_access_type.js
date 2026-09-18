/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours vs Single Experiences:
 * - vibe_tags: allow up to 4 for multi-vibe guided tours (+ multi_vibe preset)
 * - access_type: guided_route | direct_ticket | vip_event | time_sensitive
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");
  let dirty = false;

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  try {
    const vibe = tours.fields.getByName("vibe_tags");
    if (vibe) {
      vibe.maxSelect = 4;
      const vals = Array.isArray(vibe.values) ? vibe.values : [];
      if (!vals.includes("multi_vibe")) {
        vibe.values = [...vals, "multi_vibe"];
      }
      dirty = true;
    }
  } catch (_) {
    /* field may not exist yet */
  }

  if (missing("access_type")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "access_type",
        required: false,
        maxSelect: 1,
        values: [
          "guided_route",
          "direct_ticket",
          "vip_event",
          "time_sensitive",
        ],
      })
    );
    dirty = true;
  }

  if (dirty) app.save(tours);
}, (app) => {
  /* keep fields on down */
});
