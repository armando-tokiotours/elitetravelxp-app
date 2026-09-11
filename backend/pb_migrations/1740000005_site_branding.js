/// <reference path="../pb_data/types.d.ts" />
/**
 * Singleton site branding for navbar logo + builder hero.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("site_branding");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "site_branding",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "logo_image",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      },
      {
        name: "hero_background_image",
        type: "file",
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
      {
        name: "hero_title_main",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "hero_title_highlight",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "hero_subtitle",
        type: "text",
        required: false,
        max: 400,
      },
    ],
  });

  app.save(col);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("site_branding"));
  } catch (_) {}
});
