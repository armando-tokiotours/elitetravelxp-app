/// <reference path="../pb_data/types.d.ts" />
/**
 * No-op: hubs is created by 1740000004_hubs.js.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("hubs");
  } catch (_) {}
}, (app) => {});
