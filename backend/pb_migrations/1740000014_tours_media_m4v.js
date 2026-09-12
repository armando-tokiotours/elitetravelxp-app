/// <reference path="../pb_data/types.d.ts" />
/**
 * Allow .m4v tour videos (video/x-m4v) on media_file.
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");
  const media = tours.fields.getByName("media_file");
  if (!media) return;

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
  ];
  media.mimeTypes = allowed;
  app.save(tours);
}, (app) => {});
