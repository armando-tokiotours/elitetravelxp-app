/// <reference path="../pb_data/types.d.ts" />
/**
 * Pre-Builder Match Quiz story branding cards.
 * Keys: pre_elite_{optionId} · category: pre_elite
 * media = slide 1 · poster = slide 2 · title/subtitle = option copy
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("branding_ui_items");

  const categoryField = col.fields.getByName("category");
  if (categoryField) {
    const values = categoryField.values || [];
    if (!values.includes("pre_elite")) {
      categoryField.values = [...values, "pre_elite"];
    }
  }
  app.save(col);

  const seeds = [
    // Travel Style
    {
      key: "pre_elite_classic_explorer",
      title: "Classic Explorer",
      subtitle:
        "Private guide with local public transport and walking. Authentic immersion.",
      sort_order: 10,
    },
    {
      key: "pre_elite_premium_comfort",
      title: "Premium Comfort",
      subtitle:
        "Private guide with a dedicated luxury vehicle. Seamless comfort.",
      sort_order: 11,
    },
    {
      key: "pre_elite_vip_bespoke",
      title: "VIP Bespoke",
      subtitle:
        "Complete VIP access, luxury chauffeur, high-end private dining, and exclusive entry.",
      sort_order: 12,
    },
    // Interests
    {
      key: "pre_elite_culture_heritage",
      title: "Culture & Heritage",
      subtitle:
        "Shrines, tea ceremonies, historic districts, and sumo culture.",
      sort_order: 20,
    },
    {
      key: "pre_elite_food_culinary",
      title: "Food & Culinary",
      subtitle:
        "Hidden izakayas, street food, Michelin-star dining, and sake tasting.",
      sort_order: 21,
    },
    {
      key: "pre_elite_modern_pop",
      title: "Modern & Pop Culture",
      subtitle:
        "Anime, tech, shopping, nightlife, and vibrant street photography.",
      sort_order: 22,
    },
    {
      key: "pre_elite_nature_day_trips",
      title: "Nature & Day Trips",
      subtitle: "Mt. Fuji, Hakone, Kamakura, and hidden coastal villages.",
      sort_order: 23,
    },
    // Motivation
    {
      key: "pre_elite_family",
      title: "Family Vacation",
      subtitle: "Creating lifelong shared memories.",
      sort_order: 30,
    },
    {
      key: "pre_elite_romantic",
      title: "Romantic Getaway / Honeymoon",
      subtitle: "Exclusive, intimate, luxury experiences.",
      sort_order: 31,
    },
    {
      key: "pre_elite_solo",
      title: "Solo Explorer",
      subtitle: "Seeking deep, authentic local culture.",
      sort_order: 32,
    },
    {
      key: "pre_elite_first_time",
      title: "First-Time Japan Visitor",
      subtitle: "Wanting a completely smooth, stress-free experience.",
      sort_order: 33,
    },
    // What to Avoid
    {
      key: "pre_elite_language_transit",
      title: "Language & transit",
      subtitle: "Language barriers and navigating complex transit.",
      sort_order: 40,
    },
    {
      key: "pre_elite_tourist_traps",
      title: "Tourist traps",
      subtitle: "Falling into crowded, over-hyped tourist traps.",
      sort_order: 41,
    },
    {
      key: "pre_elite_authentic_dining",
      title: "Authentic dining",
      subtitle: "Finding authentic, non-touristy dining spots.",
      sort_order: 42,
    },
    {
      key: "pre_elite_packed_itinerary",
      title: "No time to breathe",
      subtitle: "An overly packed itinerary with zero time for relaxation.",
      sort_order: 43,
    },
  ];

  for (const seed of seeds) {
    try {
      app.findFirstRecordByFilter(
        "branding_ui_items",
        `key = "${seed.key}"`
      );
    } catch (_) {
      const record = new Record(col, {
        key: seed.key,
        category: "pre_elite",
        title: seed.title,
        subtitle: seed.subtitle,
        description: "",
        sort_order: seed.sort_order,
      });
      app.save(record);
    }
  }
}, (app) => {
  const keys = [
    "pre_elite_classic_explorer",
    "pre_elite_premium_comfort",
    "pre_elite_vip_bespoke",
    "pre_elite_culture_heritage",
    "pre_elite_food_culinary",
    "pre_elite_modern_pop",
    "pre_elite_nature_day_trips",
    "pre_elite_family",
    "pre_elite_romantic",
    "pre_elite_solo",
    "pre_elite_first_time",
    "pre_elite_language_transit",
    "pre_elite_tourist_traps",
    "pre_elite_authentic_dining",
    "pre_elite_packed_itinerary",
  ];
  for (const key of keys) {
    try {
      const row = app.findFirstRecordByFilter(
        "branding_ui_items",
        `key = "${key}"`
      );
      app.delete(row);
    } catch (_) {
      /* ignore */
    }
  }
});
