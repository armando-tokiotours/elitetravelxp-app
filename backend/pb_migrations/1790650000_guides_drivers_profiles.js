/// <reference path="../pb_data/types.d.ts" />
/**
 * guides + drivers — role profile overlays linked to staff auth.
 */
migrate((app) => {
  let staffId = "";
  try {
    staffId = app.findCollectionByNameOrId("staff").id;
  } catch (_) {
    return;
  }

  try {
    app.findCollectionByNameOrId("guides");
  } catch (_) {
    const guides = new Collection({
      type: "base",
      name: "guides",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "staff",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: staffId,
          cascadeDelete: false,
        },
        { name: "full_name", type: "text", required: true, max: 200 },
        { name: "email", type: "email", required: true },
        { name: "phone_number", type: "text", required: false, max: 64 },
        { name: "date_of_birth", type: "date", required: false },
        { name: "date_joined_tokiotours", type: "date", required: false },
        { name: "city_of_operation", type: "text", required: false, max: 120 },
        {
          name: "out_of_city_day_trips",
          type: "select",
          required: false,
          maxSelect: 5,
          values: ["Hakone", "Kawaguchiko", "Nikko", "Kamakura", "Nara"],
        },
        {
          name: "availability_pattern",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["Full-Time", "Weekends Only", "Part-Time"],
        },
        { name: "availability_notes", type: "text", required: false, max: 2000 },
        { name: "blackout_dates", type: "json", required: false },
        { name: "comfort_couples", type: "bool", required: false },
        { name: "comfort_family_under_12", type: "bool", required: false },
        { name: "comfort_family_12_30", type: "bool", required: false },
        { name: "comfort_family_adults_only", type: "bool", required: false },
        { name: "comfort_seniors_only", type: "bool", required: false },
        { name: "comfort_bike_tours", type: "bool", required: false },
        { name: "comfort_food_tours", type: "bool", required: false },
        { name: "comfort_ghost_tours", type: "bool", required: false },
        {
          name: "expertise_topics",
          type: "select",
          required: false,
          // PocketBase select maxSelect hard-cap is 7
          maxSelect: 7,
          values: [
            "Pop Culture",
            "Pokemon",
            "Architecture",
            "Otaku",
            "Vintage Shops",
            "Gourmet Restaurants",
            "Technology",
          ],
        },
        { name: "other_expertise", type: "text", required: false, max: 2000 },
        {
          name: "perfect_day_tour_description",
          type: "text",
          required: false,
          max: 5000,
        },
        {
          name: "main_tour_languages",
          type: "select",
          required: false,
          maxSelect: 6,
          values: [
            "English",
            "Spanish",
            "Dutch",
            "French",
            "German",
            "Italian",
          ],
        },
        {
          name: "japanese_jlpt_level",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["N5", "N4", "N3", "N2", "N1", "Native", "None"],
        },
        { name: "visa_type", type: "text", required: false, max: 200 },
        { name: "visa_expiration_date", type: "date", required: false },
        { name: "base_rate_6h_or_less", type: "number", required: false, min: 0 },
        { name: "base_rate_8h_or_less", type: "number", required: false, min: 0 },
        {
          name: "extra_head_percentage",
          type: "number",
          required: false,
          min: 0,
        },
        { name: "fee_min", type: "number", required: false, min: 0 },
        { name: "fee_max", type: "number", required: false, min: 0 },
        {
          name: "rate_currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["JPY", "EUR"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_guides_staff ON guides (`staff`)",
      ],
    });
    app.save(guides);
  }

  try {
    app.findCollectionByNameOrId("drivers");
  } catch (_) {
    const drivers = new Collection({
      type: "base",
      name: "drivers",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "staff",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: staffId,
          cascadeDelete: false,
        },
        {
          name: "driver_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["independent", "fleet_coordinator"],
        },
        { name: "company_fleet_name", type: "text", required: false, max: 200 },
        { name: "full_name", type: "text", required: true, max: 200 },
        { name: "phone_number", type: "text", required: false, max: 64 },
        {
          name: "operating_cities",
          type: "select",
          required: false,
          // PocketBase select maxSelect hard-cap is 7
          maxSelect: 7,
          values: [
            "Tokyo",
            "Kyoto",
            "Osaka",
            "Fuji / Hakone",
            "Hiroshima",
            "Nara",
            "Nagoya",
            "Other",
          ],
        },
        {
          name: "operating_license_number",
          type: "text",
          required: false,
          max: 120,
        },
        { name: "blackout_dates", type: "json", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_drivers_staff ON drivers (`staff`)",
      ],
    });
    app.save(drivers);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("drivers"));
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId("guides"));
  } catch (_) {}
});
