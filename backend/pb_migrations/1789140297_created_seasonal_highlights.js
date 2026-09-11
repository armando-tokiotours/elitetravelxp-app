/// <reference path="../pb_data/types.d.ts" />
/**
 * No-op: seasonal_highlights is created by 1740000003_seasonal_highlights.js.
 * Kept so PocketBase migration history stays consistent on hosts that saw this file.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("seasonal_highlights");
  } catch (_) {
    /* already handled by earlier migration */
  }
}, (app) => {});
