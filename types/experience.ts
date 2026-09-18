/**
 * 3-Tag classification for tours/activities.
 * Tag once in PocketBase — quiz matching stays rule-based (no AI).
 *
 * Guided Tours = multi-stop, multi-vibe day packages.
 * Single Experiences = ticketed / VIP / time-sensitive focus items.
 */

export type ExperienceVibeTag =
  | "culture"
  | "foodie"
  | "modern"
  | "nature"
  | "multi_vibe";

export type ExperiencePaceTag = "relaxed" | "standard" | "active";

export type ExperienceAccessType =
  | "guided_route"
  | "direct_ticket"
  | "vip_event"
  | "time_sensitive";

export type ExperienceCrowdTag =
  | "hidden_gem"
  | "classic_highlight"
  | "balanced_mix";

export type ExperienceCategory = "tour" | "activity";

export type ExperienceCitySlug = "tokyo" | "kamakura" | "kyoto" | "osaka";

/** Canonical shape for matcher + admin tagging. */
export interface TourOrExperience {
  id: string;
  title: string;
  category: ExperienceCategory;
  vibeTags: ExperienceVibeTag[];
  paceTag: ExperiencePaceTag;
  isNiche: boolean;
  accessType?: ExperienceAccessType;
  crowdTag?: ExperienceCrowdTag;
  description: string;
  route?: string;
}

export interface Experience {
  id: string;
  title: string;
  city: ExperienceCitySlug | string;
  durationHours: number;
  pricePerPax: number;
  /** Tours: multiple vibes · Activities: 1 primary */
  vibeTags: ExperienceVibeTag[];
  paceTag: ExperiencePaceTag;
  /** Highly specific / VIP — only when quiz allows niche */
  isNiche?: boolean;
  category?: ExperienceCategory;
  accessType?: ExperienceAccessType;
  crowdTag?: ExperienceCrowdTag;
  description: string;
  image: string;
}

export const VIBE_TAG_OPTIONS: {
  id: ExperienceVibeTag;
  label: string;
  hint: string;
}[] = [
  {
    id: "culture",
    label: "Culture",
    hint: "Temples, tea ceremony, traditional crafts",
  },
  {
    id: "foodie",
    label: "Foodie",
    hint: "Sake tasting, markets, izakaya crawls",
  },
  {
    id: "modern",
    label: "Modern",
    hint: "Anime, digital art, shopping, nightlife",
  },
  {
    id: "nature",
    label: "Nature",
    hint: "Fuji views, gardens, hiking, bamboo",
  },
  {
    id: "multi_vibe",
    label: "Multi-Vibe / Full Day Mix",
    hint: "Balanced route across several neighborhoods",
  },
];

/** Core vibes used by the guest quiz (excludes multi_vibe preset). */
export const PRIMARY_VIBE_TAGS: Exclude<ExperienceVibeTag, "multi_vibe">[] = [
  "culture",
  "foodie",
  "modern",
  "nature",
];

export const ACCESS_TYPE_OPTIONS: {
  id: ExperienceAccessType;
  label: string;
  hint: string;
}[] = [
  {
    id: "guided_route",
    label: "Private guide / chauffeur route",
    hint: "Multi-stop guided day",
  },
  {
    id: "direct_ticket",
    label: "Ticket / Admission",
    hint: "Direct entry ticket",
  },
  {
    id: "vip_event",
    label: "VIP Exclusive",
    hint: "VIP or exclusive access",
  },
  {
    id: "time_sensitive",
    label: "Time-Sensitive Event",
    hint: "Seasonal dates (Sumo, sakura, etc.)",
  },
];

export const PACE_TAG_OPTIONS: {
  id: ExperiencePaceTag;
  label: string;
  hint: string;
}[] = [
  {
    id: "relaxed",
    label: "Relaxed",
    hint: "Low walking, 2–3 hours max",
  },
  {
    id: "standard",
    label: "Standard",
    hint: "Half-day tours, 4–6 hours",
  },
  {
    id: "active",
    label: "Active",
    hint: "Full-day, heavy walking, 8+ hours",
  },
];

const VIBE_SET = new Set<string>([
  "culture",
  "foodie",
  "modern",
  "nature",
  "multi_vibe",
]);
const PACE_SET = new Set<string>(["relaxed", "standard", "active"]);
const ACCESS_SET = new Set<string>([
  "guided_route",
  "direct_ticket",
  "vip_event",
  "time_sensitive",
]);
const CROWD_SET = new Set<string>([
  "hidden_gem",
  "classic_highlight",
  "balanced_mix",
]);

export function normalizeVibeTags(raw: unknown): ExperienceVibeTag[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => String(v).toLowerCase().trim())
    .filter((v): v is ExperienceVibeTag => VIBE_SET.has(v));
}

export function normalizePaceTag(raw: unknown): ExperiencePaceTag | null {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (v === "balanced") return "standard";
  return PACE_SET.has(v) ? (v as ExperiencePaceTag) : null;
}

export function normalizeAccessType(raw: unknown): ExperienceAccessType | null {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  return ACCESS_SET.has(v) ? (v as ExperienceAccessType) : null;
}

export function normalizeCrowdTag(raw: unknown): ExperienceCrowdTag | null {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (!v) return null;
  if (v === "hidden_gems" || v === "hiddengem" || v === "niche") {
    return "hidden_gem";
  }
  if (v === "classic" || v === "classic_landmarks" || v === "landmark") {
    return "classic_highlight";
  }
  if (v === "balanced" || v === "mix" || v === "open_explorer") {
    return "balanced_mix";
  }
  return CROWD_SET.has(v) ? (v as ExperienceCrowdTag) : null;
}

export function normalizeCategory(raw: unknown): ExperienceCategory {
  return String(raw ?? "")
    .toLowerCase()
    .trim() === "activity"
    ? "activity"
    : "tour";
}

/** Infer pace from duration when Team Access has not tagged the row yet. */
export function inferPaceFromHours(hours: number): ExperiencePaceTag {
  if (hours > 0 && hours <= 3.5) return "relaxed";
  if (hours >= 7) return "active";
  return "standard";
}

const VIBE_KEYWORDS: Record<
  Exclude<ExperienceVibeTag, "multi_vibe">,
  string[]
> = {
  culture: [
    "temple",
    "shrine",
    "museum",
    "historic",
    "heritage",
    "castle",
    "tea",
    "geisha",
    "samurai",
    "traditional",
    "craft",
    "faces of tokyo",
    "sumo",
  ],
  foodie: [
    "food",
    "foodie",
    "culinary",
    "sushi",
    "ramen",
    "market",
    "tasting",
    "sake",
    "izakaya",
    "dining",
    "street food",
    "cook",
    "tsukiji",
  ],
  modern: [
    "modern",
    "pop",
    "anime",
    "shopping",
    "nightlife",
    "design",
    "harajuku",
    "shibuya",
    "akihabara",
    "teamlab",
    "digital",
  ],
  nature: [
    "nature",
    "scenery",
    "fuji",
    "mountain",
    "hike",
    "garden",
    "bamboo",
    "onsen",
    "kamakura",
    "hakone",
    "scenic",
  ],
};

/** Infer vibe tags from title/description when PB tags are empty. */
export function inferVibeTags(
  text: string,
  category: ExperienceCategory = "tour"
): ExperienceVibeTag[] {
  const hay = text.toLowerCase();
  const scored = (PRIMARY_VIBE_TAGS as Exclude<ExperienceVibeTag, "multi_vibe">[])
    .map((vibe) => ({
      vibe,
      hits: VIBE_KEYWORDS[vibe].filter((k) => hay.includes(k)).length,
    }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const max = category === "activity" ? 1 : 4;
  return scored.slice(0, max).map((x) => x.vibe);
}

export function resolveTourTags(tour: {
  title?: string;
  description?: string;
  category?: string;
  duration_hours?: number;
  vibe_tags?: string[] | ExperienceVibeTag[];
  pace_tag?: string | ExperiencePaceTag;
  is_niche?: boolean;
  access_type?: string | ExperienceAccessType;
  crowd_tag?: string | ExperienceCrowdTag;
}): {
  category: ExperienceCategory;
  vibeTags: ExperienceVibeTag[];
  paceTag: ExperiencePaceTag;
  isNiche: boolean;
  accessType: ExperienceAccessType;
  crowdTag: ExperienceCrowdTag | null;
} {
  const category = normalizeCategory(tour.category);
  const explicit = normalizeVibeTags(tour.vibe_tags);
  const maxTags = category === "activity" ? 1 : 4;
  let vibeTags =
    explicit.length > 0
      ? explicit.slice(0, maxTags)
      : inferVibeTags(
          `${tour.title ?? ""} ${tour.description ?? ""} ${tour.category ?? ""}`,
          category
        );

  // Tours with 2+ primary vibes count as multi-vibe packages for matching.
  if (
    category === "tour" &&
    !vibeTags.includes("multi_vibe") &&
    vibeTags.filter((v) => v !== "multi_vibe").length >= 2
  ) {
    vibeTags = [...vibeTags, "multi_vibe"];
  }

  const paceTag =
    normalizePaceTag(tour.pace_tag) ??
    inferPaceFromHours(Number(tour.duration_hours) || 0);

  const accessType =
    normalizeAccessType(tour.access_type) ??
    (category === "tour" ? "guided_route" : "direct_ticket");

  const crowdTag = normalizeCrowdTag(tour.crowd_tag);

  return {
    category,
    vibeTags,
    paceTag,
    isNiche: Boolean(tour.is_niche),
    accessType,
    crowdTag,
  };
}
