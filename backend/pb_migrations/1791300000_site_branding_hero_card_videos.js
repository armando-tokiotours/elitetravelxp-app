/// <reference path="../pb_data/types.d.ts" />
/**
 * Homepage hero accordion cards — per-card uploaded video.
 * Mirrors the hero_card_{single,experience,multiday}_photo file fields:
 * one optional video file per card (mp4/webm, ≤50MB), uploaded via
 * Site Branding → Homepage Hero Cards studio when Media = Video Upload.
 * The card's media type + external embed URL live in hero_intro_config
 * JSON (mediaType / mediaEmbedUrl), not in schema fields.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("site_branding");

  const addFile = (name) => {
    try {
      if (col.fields.getByName(name)) return;
    } catch (_) {
      /* field missing — add it below */
    }
    col.fields.add(
      new Field({
        type: "file",
        name,
        required: false,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: [
          "video/mp4",
          "video/webm",
        ],
      })
    );
  };

  for (const card of ["single", "experience", "multiday"]) {
    addFile(`hero_card_${card}_video`);
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("site_branding");
    for (const card of ["single", "experience", "multiday"]) {
      const f = col.fields.getByName(`hero_card_${card}_video`);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {}
});
