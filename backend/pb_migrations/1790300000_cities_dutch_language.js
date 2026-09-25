/// <reference path="../pb_data/types.d.ts" />
/**
 * Ensure Dutch is in cities.available_languages options + defaults.
 */
migrate((app) => {
  const cities = app.findCollectionByNameOrId("cities");
  try {
    const field = cities.fields.getByName("available_languages");
    if (field && field.values && !field.values.includes("Dutch")) {
      field.values = [
        "English",
        "Dutch",
        "Japanese",
        "French",
        "German",
        "Spanish",
        "Italian",
        "Portuguese",
        "Chinese",
        "Korean",
      ];
      app.save(cities);
    }
  } catch (_) {
    /* field may not exist yet */
  }

  const rows = app.findAllRecords(cities);
  for (const row of rows) {
    const existing = row.get("available_languages");
    let list = [];
    if (Array.isArray(existing)) list = existing.map(String);
    else if (typeof existing === "string" && existing.trim()) {
      try {
        const parsed = JSON.parse(existing);
        list = Array.isArray(parsed) ? parsed.map(String) : existing.split(",");
      } catch {
        list = existing.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    if (!list.includes("Dutch")) {
      list.push("Dutch");
      row.set("available_languages", list);
      app.save(row);
    }
  }
}, (app) => {
  /* keep Dutch in lists */
});
