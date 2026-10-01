/// <reference path="../pb_data/types.d.ts" />
/**
 * Guide double-confirmation modes on ops_dispatch.guide_mode.
 * Keeps legacy values (direct/open/claimed) for existing rows.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("ops_dispatch");
  const field = col.fields.getByName("guide_mode");
  if (!field) return;
  field.values = [
    "unassigned",
    "direct",
    "open",
    "claimed",
    "pending_guide_acceptance",
    "posted_open_board",
    "guide_confirmed",
  ];
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("ops_dispatch");
  const field = col.fields.getByName("guide_mode");
  if (!field) return;
  field.values = ["unassigned", "direct", "open", "claimed"];
  app.save(col);
});
