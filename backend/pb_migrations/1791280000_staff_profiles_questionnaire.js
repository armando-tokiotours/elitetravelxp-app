/// <reference path="../pb_data/types.d.ts" />
/**
 * staff_profiles fields from the "Tokiotours Guide Questionnaire — Kanto".
 * Multi-selects are comma-separated text (codebase convention, see
 * languages / specialties); language_fluency is a JSON string like
 * {"English":5,"Japanese":4}. All fields are optional in PocketBase so
 * existing profile rows/saves keep working — the Guide Portal UI treats
 * key fields (e.g. guiding_tenure, strength_regions) as required with
 * ⚠️ prompts instead.
 */
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    const add = (field) => {
      if (!col.fields.getByName(field.name)) {
        col.fields.add(new Field(field));
      }
    };
    add({ type: "text", name: "guiding_tenure", required: false, max: 50 });
    add({ type: "text", name: "base_location", required: false, max: 200 });
    add({ type: "text", name: "language_fluency", required: false, max: 1000 });
    add({ type: "text", name: "strength_regions", required: false, max: 500 });
    add({ type: "text", name: "tour_specialties", required: false, max: 500 });
    add({ type: "text", name: "tours_to_avoid", required: false, max: 1000 });
    add({ type: "text", name: "preferred_clients", required: false, max: 500 });
    add({ type: "text", name: "challenging_clients", required: false, max: 1000 });
    add({ type: "number", name: "skill_storytelling", required: false, min: 0, max: 5 });
    add({ type: "number", name: "skill_logistics", required: false, min: 0, max: 5 });
    add({ type: "number", name: "skill_problem_solving", required: false, min: 0, max: 5 });
    add({ type: "number", name: "skill_kids_patience", required: false, min: 0, max: 5 });
    add({ type: "number", name: "skill_conflict_resolution", required: false, min: 0, max: 5 });
    add({ type: "number", name: "skill_stamina", required: false, min: 0, max: 5 });
    add({ type: "text", name: "biggest_strength", required: false, max: 1000 });
    add({ type: "text", name: "improvement_areas", required: false, max: 1000 });
    add({ type: "text", name: "early_starts", required: false, max: 50 });
    add({ type: "text", name: "full_day_tours", required: false, max: 50 });
    add({ type: "text", name: "physical_limitations", required: false, max: 1000 });
    app.save(col);
    console.log("[1791280000] staff_profiles questionnaire fields ready");
  } catch (e) {
    console.log("[1791280000] staff_profiles questionnaire fields:", e);
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("staff_profiles");
    for (const name of [
      "guiding_tenure",
      "base_location",
      "language_fluency",
      "strength_regions",
      "tour_specialties",
      "tours_to_avoid",
      "preferred_clients",
      "challenging_clients",
      "skill_storytelling",
      "skill_logistics",
      "skill_problem_solving",
      "skill_kids_patience",
      "skill_conflict_resolution",
      "skill_stamina",
      "biggest_strength",
      "improvement_areas",
      "early_starts",
      "full_day_tours",
      "physical_limitations",
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
