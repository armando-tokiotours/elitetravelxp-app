/// <reference path="../pb_data/types.d.ts" />
/**
 * Brandable UI cards (travel pace, style quiz, concierge previews).
 * Edited from Team Access → Site Branding. Public list/view for the builder.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("branding_ui_items");
    return;
  } catch (_) {
    /* create below */
  }

  const col = new Collection({
    type: "base",
    name: "branding_ui_items",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "key",
        type: "text",
        required: true,
        min: 1,
        max: 80,
      },
      {
        name: "category",
        type: "select",
        required: true,
        maxSelect: 1,
        values: [
          "pace",
          "quiz_vibe",
          "quiz_pace",
          "quiz_crowd",
          "concierge",
        ],
      },
      {
        name: "title",
        type: "text",
        required: false,
        max: 120,
      },
      {
        name: "subtitle",
        type: "text",
        required: false,
        max: 240,
      },
      {
        name: "description",
        type: "text",
        required: false,
        max: 8000,
      },
      {
        name: "media",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-m4v",
        ],
        thumbs: ["100x100", "400x400", "600x400"],
      },
      {
        name: "sort_order",
        type: "number",
        required: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_branding_ui_items_key ON branding_ui_items (`key`)",
    ],
  });

  app.save(col);

  const seeds = [
    {
      key: "pace_fast",
      category: "pace",
      title: "Fast",
      subtitle: "See more, linger less",
      description:
        "Packed days with multiple highlights. Ideal if this is a first visit and you want maximum coverage.\n\nExpect earlier starts, efficient transfers between cities, and fuller daily schedules. Best for energetic travelers who prefer momentum over downtime.",
      sort_order: 1,
    },
    {
      key: "pace_moderate",
      category: "pace",
      title: "Moderate",
      subtitle: "Balanced discovery",
      description:
        "A classic rhythm — signature experiences with room to breathe between them.\n\nOne primary focus per day with optional add-ons. Comfortable pacing for couples and families who want culture and rest in equal measure.",
      sort_order: 2,
    },
    {
      key: "pace_relaxed",
      category: "pace",
      title: "Relaxed",
      subtitle: "Slow luxury",
      description:
        "Fewer moves, deeper stays. Space for spa mornings, long lunches, and unhurried evenings.\n\nLonger city stays and lighter daily agendas. Perfect when the journey itself is the destination and recovery matters as much as sightseeing.",
      sort_order: 3,
    },
    {
      key: "quiz_vibe_culture",
      category: "quiz_vibe",
      title: "Culture & Heritage",
      subtitle: "Temples, tea ceremony, traditional crafts",
      description: "",
      sort_order: 1,
    },
    {
      key: "quiz_vibe_foodie",
      category: "quiz_vibe",
      title: "Food & Nightlife",
      subtitle: "Markets, sake, izakaya, culinary crawls",
      description: "",
      sort_order: 2,
    },
    {
      key: "quiz_vibe_modern",
      category: "quiz_vibe",
      title: "Modern & Pop Culture",
      subtitle: "Anime, digital art, shopping districts",
      description: "",
      sort_order: 3,
    },
    {
      key: "quiz_vibe_nature",
      category: "quiz_vibe",
      title: "Nature & Scenery",
      subtitle: "Fuji views, gardens, hiking, bamboo",
      description: "",
      sort_order: 4,
    },
    {
      key: "quiz_pace_relaxed",
      category: "quiz_pace",
      title: "Take it easy, no stress",
      subtitle: "1 activity / day · low walking",
      description: "",
      sort_order: 1,
    },
    {
      key: "quiz_pace_standard",
      category: "quiz_pace",
      title: "Balanced half-days",
      subtitle: "2 activities / day · 4–6 hours",
      description: "",
      sort_order: 2,
    },
    {
      key: "quiz_pace_active",
      category: "quiz_pace",
      title: "Full schedule",
      subtitle: "Packed days · heavy walking",
      description: "",
      sort_order: 3,
    },
    {
      key: "quiz_crowd_hidden_gems",
      category: "quiz_crowd",
      title: "Hidden Gems & Quiet Secrets",
      subtitle: "Off-path finds and rare VIP experiences",
      description: "",
      sort_order: 1,
    },
    {
      key: "quiz_crowd_classic",
      category: "quiz_crowd",
      title: "Classic Landmarks",
      subtitle: "Iconic must-sees everyone loves",
      description: "",
      sort_order: 2,
    },
    {
      key: "quiz_crowd_balanced",
      category: "quiz_crowd",
      title: "A Balanced Mix",
      subtitle: "Famous spots plus a few quieter finds",
      description: "",
      sort_order: 3,
    },
    {
      key: "concierge_preview",
      category: "concierge",
      title: "Elite Concierge",
      subtitle: "Day-by-day design with a dedicated specialist",
      description:
        "One dedicated specialist plans every detail — restaurants, experiences, and logistics — so you travel without the guesswork.",
      sort_order: 1,
    },
  ];

  for (const seed of seeds) {
    app.save(new Record(col, seed));
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("branding_ui_items"));
  } catch (_) {
    /* already gone */
  }
});
