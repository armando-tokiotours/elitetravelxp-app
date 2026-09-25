import {
  SINGLE_DAY_BUILDER_CONFIG,
  SINGLE_DAY_BUILDER_HERO_KEY,
} from "@/config/mediaConfig";

/**
 * Fallback copy + media for brandable UI cards (pace / quiz / concierge).
 * Used when PocketBase records are missing or fields are empty.
 */

export type BrandingUiCategory =
  | "pace"
  | "quiz_vibe"
  | "quiz_pace"
  | "quiz_crowd"
  | "concierge"
  | "matcher"
  | "planner"
  | "value"
  | "builder"
  | "pre_elite";

export type BrandingUiKey = string;

export interface BrandingUiFallback {
  key: BrandingUiKey;
  category: BrandingUiCategory;
  title: string;
  subtitle: string;
  /** Modal / long-form body */
  description: string;
  /** Static public path when no PB media is uploaded */
  mediaFallback: string;
  sortOrder: number;
  ctaPrimary?: string;
  ctaSecondary?: string;
  inclusionTitle?: string;
  inclusionBody?: string;
  creditTitle?: string;
  creditBody?: string;
}

export const BRANDING_UI_FALLBACKS: Record<string, BrandingUiFallback> = {
  pace_fast: {
    key: "pace_fast",
    category: "pace",
    title: "Fast",
    subtitle: "See more, linger less",
    description:
      "Packed days with multiple highlights. Ideal if this is a first visit and you want maximum coverage.\n\nExpect earlier starts, efficient transfers between cities, and fuller daily schedules. Best for energetic travelers who prefer momentum over downtime.",
    mediaFallback: "/photo/pace-fast.jpg",
    sortOrder: 1,
  },
  pace_moderate: {
    key: "pace_moderate",
    category: "pace",
    title: "Moderate",
    subtitle: "Balanced discovery",
    description:
      "A classic rhythm — signature experiences with room to breathe between them.\n\nOne primary focus per day with optional add-ons. Comfortable pacing for couples and families who want culture and rest in equal measure.",
    mediaFallback: "/photo/pace-moderate.jpg",
    sortOrder: 2,
  },
  pace_relaxed: {
    key: "pace_relaxed",
    category: "pace",
    title: "Relaxed",
    subtitle: "Slow luxury",
    description:
      "Fewer moves, deeper stays. Space for spa mornings, long lunches, and unhurried evenings.\n\nLonger city stays and lighter daily agendas. Perfect when the journey itself is the destination and recovery matters as much as sightseeing.",
    mediaFallback: "/photo/pace-relaxed.jpg",
    sortOrder: 3,
  },
  quiz_vibe_culture: {
    key: "quiz_vibe_culture",
    category: "quiz_vibe",
    title: "Culture & Heritage",
    subtitle: "Temples, tea ceremony, traditional crafts",
    description: "",
    mediaFallback: "",
    sortOrder: 1,
  },
  quiz_vibe_foodie: {
    key: "quiz_vibe_foodie",
    category: "quiz_vibe",
    title: "Food & Nightlife",
    subtitle: "Markets, sake, izakaya, culinary crawls",
    description: "",
    mediaFallback: "",
    sortOrder: 2,
  },
  quiz_vibe_modern: {
    key: "quiz_vibe_modern",
    category: "quiz_vibe",
    title: "Modern & Pop Culture",
    subtitle: "Anime, digital art, shopping districts",
    description: "",
    mediaFallback: "",
    sortOrder: 3,
  },
  quiz_vibe_nature: {
    key: "quiz_vibe_nature",
    category: "quiz_vibe",
    title: "Nature & Scenery",
    subtitle: "Fuji views, gardens, hiking, bamboo",
    description: "",
    mediaFallback: "",
    sortOrder: 4,
  },
  quiz_pace_relaxed: {
    key: "quiz_pace_relaxed",
    category: "quiz_pace",
    title: "Take it easy, no stress",
    subtitle: "1 activity / day · low walking",
    description: "",
    mediaFallback: "",
    sortOrder: 1,
  },
  quiz_pace_standard: {
    key: "quiz_pace_standard",
    category: "quiz_pace",
    title: "Balanced half-days",
    subtitle: "2 activities / day · 4–6 hours",
    description: "",
    mediaFallback: "",
    sortOrder: 2,
  },
  quiz_pace_active: {
    key: "quiz_pace_active",
    category: "quiz_pace",
    title: "Full schedule",
    subtitle: "Packed days · heavy walking",
    description: "",
    mediaFallback: "",
    sortOrder: 3,
  },
  quiz_crowd_hidden_gems: {
    key: "quiz_crowd_hidden_gems",
    category: "quiz_crowd",
    title: "Hidden Gems & Quiet Secrets",
    subtitle: "Off-path finds and rare VIP experiences",
    description: "",
    mediaFallback: "",
    sortOrder: 1,
  },
  quiz_crowd_classic: {
    key: "quiz_crowd_classic",
    category: "quiz_crowd",
    title: "Classic Landmarks",
    subtitle: "Iconic must-sees everyone loves",
    description: "",
    mediaFallback: "",
    sortOrder: 2,
  },
  quiz_crowd_balanced: {
    key: "quiz_crowd_balanced",
    category: "quiz_crowd",
    title: "A Balanced Mix",
    subtitle: "Famous spots plus a few quieter finds",
    description: "",
    mediaFallback: "",
    sortOrder: 3,
  },
  concierge_preview: {
    key: "concierge_preview",
    category: "concierge",
    title: "Elite Concierge",
    subtitle: "Day-by-day design with a dedicated specialist",
    description:
      "One dedicated specialist plans every detail — restaurants, experiences, and logistics — so you travel without the guesswork.",
    mediaFallback: "/videos/elite-concierge-preview.mp4",
    sortOrder: 1,
  },
  elite_concierge_modal: {
    key: "elite_concierge_modal",
    category: "concierge",
    title: "Day-by-Day Design",
    subtitle: "Design deposit €50",
    description: "",
    mediaFallback: "/videos/elite-concierge-preview.mp4",
    sortOrder: 0,
    inclusionTitle: "What's included",
    inclusionBody:
      "Skip individual planning. A dedicated luxury concierge curates your entire day-by-day itinerary: exclusive dining reservations, hidden sights, and private drivers for the full trip.\n\n• Full itinerary design by a Japan specialist\n• Hard-to-get reservations and private access\n• Private drivers coordinated across your route\n\nSelecting Elite Concierge replaces any individually chosen city experiences with the concierge design package.",
    creditTitle: "100% credit toward your trip",
    creditBody:
      "The €50 design deposit is fully applied as a credit toward your final trip balance when you confirm your booking. You are not paying an extra fee on top of your itinerary.\n\nThink of it as a commitment deposit that rolls into your invoice, not a sunk cost.",
  },
  activity_matcher_banner: {
    key: "activity_matcher_banner",
    category: "matcher",
    title: "Activity Matcher",
    subtitle: "Unsure what to pick? Take our 30-Second Activity Matcher",
    description: "",
    mediaFallback: "/images/matcher-poster.webp",
    sortOrder: 1,
    ctaPrimary: "Watch Your Activity Match Reel",
    ctaSecondary: "Take 30-Sec Style Quiz",
  },
  budget_planner: {
    key: "budget_planner",
    category: "planner",
    title: "Travel Japan Your Way — Fits Any Budget",
    subtitle: "TAILORED PLANNING",
    description:
      "Have a tight or specific budget? Input your target limits and we will curate the best affordable sights, transit, and optional experiences for you.",
    mediaFallback: "/images/matcher-poster.webp",
    sortOrder: 1,
    ctaPrimary: "Open Budget Planner",
    ctaSecondary: "Back to Builder",
  },
  value_proposition: {
    key: "value_proposition",
    category: "value",
    title: "The TOKIOTOURS Difference",
    subtitle: "Cultural Translation, Not Just Sightseeing",
    description:
      "Seamless Logistics: Zero language barriers, no local rule confusion, and VIP crowd navigation.\nCultural Translator: Move beyond Wikipedia facts—understand the deep history, unwritten etiquette, and hidden stories.\nTime & Comfort Optimization: Skip queues, avoid travel friction, and experience Japan at your preferred rhythm.",
    mediaFallback: "",
    sortOrder: 0,
    ctaPrimary: "Explore Elite Experiences",
    ctaSecondary: "Compare options",
    inclusionTitle: "Why Book an Elite Specialist?",
    inclusionBody:
      "Logistics mastery, culture-to-culture translation, and exclusive access — so you experience Japan without friction, guesswork, or tourist-trap detours.",
    creditTitle: "Self-Guided (Ticket Only): Photo opportunity & entry.",
    creditBody:
      "Elite Guided Experience: Full cultural translation, zero transit friction, and local etiquette masterclass.",
  },
  single_day_builder_hero: {
    key: SINGLE_DAY_BUILDER_HERO_KEY,
    category: "builder",
    /** Beauty-script accent (red) overlaid on the scenic hero */
    title: SINGLE_DAY_BUILDER_CONFIG.hero.scriptAccent,
    /** Tagline under the hero title stack */
    subtitle: SINGLE_DAY_BUILDER_CONFIG.hero.subtitle,
    description: "",
    mediaFallback: SINGLE_DAY_BUILDER_CONFIG.hero.videoUrl,
    sortOrder: 0,
    /** Godiva / sheet prefix — e.g. "YOUR DAY IN" */
    ctaPrimary: SINGLE_DAY_BUILDER_CONFIG.hero.mainTitlePrefix,
  },
  transit_walk: {
    key: "transit_walk",
    category: "builder",
    title: "Walking",
    subtitle: "Neighborhood pace on foot",
    description:
      "Your host leads you through alleys, temples, and market streets on foot. Ideal for compact districts where the best moments sit between subway exits.\n\nComfortable shoes recommended. Luggage stays at your hotel; we plan loops that return you near your meeting point.",
    mediaFallback: "/brand/hero-single-day.jpg",
    sortOrder: 10,
  },
  transit_subway: {
    key: "transit_subway",
    category: "builder",
    title: "Subway",
    subtitle: "IC card + guided transfers",
    description:
      "We provide (or top up) a Suica/Pasmo IC card and escort every transfer. Your host handles ticket gates, platform changes, and station exits so you never guess which stairs to take.\n\nBest for covering distant districts in one day while staying light and flexible.",
    mediaFallback: "/brand/hero-single-day.jpg",
    sortOrder: 11,
  },
  transit_private_driver: {
    key: "transit_private_driver",
    category: "builder",
    title: "Private Driver",
    subtitle: "Door-to-door vehicle",
    description:
      "A licensed private driver meets you at your hotel or station hub and relocates you between stops. Drop-off at each experience; rejoin after for the next leg.\n\nBest for families, luggage days, rain, or when you want zero station friction between icons.",
    mediaFallback: "/brand/hero-single-day.jpg",
    sortOrder: 12,
  },
};

export const CONCIERGE_POSTER_FALLBACK = "/images/concierge-poster.webp";

export const PACE_IDS = ["fast", "moderate", "relaxed"] as const;
export const QUIZ_VIBE_IDS = [
  "culture",
  "foodie",
  "modern",
  "nature",
] as const;
export const QUIZ_PACE_IDS = ["relaxed", "standard", "active"] as const;
export const QUIZ_CROWD_IDS = [
  "hidden_gems",
  "classic",
  "balanced",
] as const;

export function paceBrandingKey(id: string): string {
  return `pace_${id}`;
}

export function quizVibeBrandingKey(id: string): string {
  return `quiz_vibe_${id}`;
}

export function quizPaceBrandingKey(id: string): string {
  return `quiz_pace_${id}`;
}

export function quizCrowdBrandingKey(id: string): string {
  return `quiz_crowd_${id}`;
}

export function isVideoFilename(name: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(name);
}

/** Strip simple HTML from PocketBase editor fields for plain-text UI. */
export function plainBrandingText(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
