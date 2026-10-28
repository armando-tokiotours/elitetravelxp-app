/// <reference path="../pb_data/types.d.ts" />
/**
 * Store VPS/CDN media pointers on tours (cover_url, media_url)
 * so heavy files can live under public/uploads without PB bloat.
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
  if (missing("cover_url")) {
    tours.fields.add(
      new Field({
        type: "text",
        name: "cover_url",
        required: false,
      })
    );
    dirty = true;
  }
  if (missing("media_url")) {
    tours.fields.add(
      new Field({
        type: "text",
        name: "media_url",
        required: false,
      })
    );
    dirty = true;
  }
  if (dirty) app.save(tours);
}, (app) => {
  const tours = app.findCollectionByNameOrId("tours");
  for (const name of ["cover_url", "media_url"]) {
    try {
      const f = tours.fields.getByName(name);
      if (f) tours.fields.removeById(f.id);
    } catch (_) {
      /* */
    }
  }
  app.save(tours);
});
