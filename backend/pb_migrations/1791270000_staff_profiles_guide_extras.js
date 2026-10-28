/// <reference path="../pb_data/types.d.ts" />
/**
 * staff_profiles guide extras for the social Guide Profile:
 * - specialties (comma-separated niches, e.g. "Otaku Culture, Food & Culinary")
 * - tour preferences: max_group_size / pace_comfort / transit_comfort
 * - structured banking for contractor payouts (bank_name / bank_branch /
 *   account_type / account_holder / account_number). Legacy free-text
 *   bank_info stays untouched; the guide UI composes it from these.
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    const add = (field) => {
      if (!col.fields.getByName(field.name)) {
        col.fields.add(new Field(field));
      }
    };
    add({ type: "text", name: "specialties", required: false, max: 500 });
    add({ type: "number", name: "max_group_size", required: false, min: 0 });
    add({ type: "text", name: "pace_comfort", required: false, max: 100 });
    add({ type: "text", name: "transit_comfort", required: false, max: 100 });
    add({ type: "text", name: "bank_name", required: false, max: 200 });
    add({ type: "text", name: "bank_branch", required: false, max: 200 });
    add({ type: "text", name: "account_type", required: false, max: 100 });
    add({ type: "text", name: "account_holder", required: false, max: 200 });
    add({ type: "text", name: "account_number", required: false, max: 64 });
    app.save(col);
    console.log("[1791270000] staff_profiles guide extras ready");
  } catch (e) {
    console.log("[1791270000] staff_profiles guide extras:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    for (const name of [
      "specialties",
      "max_group_size",
      "pace_comfort",
      "transit_comfort",
      "bank_name",
      "bank_branch",
      "account_type",
      "account_holder",
      "account_number",
    ]) {
      try {
        col.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
