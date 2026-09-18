/**
 * Experience Profiler — quiz UI + tag-based matching facade.
 * Matching rules live in utils/quizMatcher.ts (3-tag system).
 */

import type { ExperiencePaceTag, ExperienceVibeTag } from "@/types/experience";
import {
  filterAndRankToursByQuiz,
  matchesQuizAnswers,
  scoreTourAgainstQuiz,
  type QuizAnswers,
} from "@/utils/quizMatcher";

export type ProfilerPace = ExperiencePaceTag;
export type ProfilerVibe = Exclude<ExperienceVibeTag, "multi_vibe">;
export type ProfilerCrowdStyle = "hidden_gems" | "classic" | "balanced";
/** @deprecated Quiz Q3 is now crowdStyle — kept for persisted profiles */
export type ProfilerTransport = "chauffeur" | "local";

export type UserProfileTag = string;

export interface ExperienceProfile {
  pace: ProfilerPace;
  vibe: ProfilerVibe;
  /** Always mirrors [vibe] for matcher multi-select API */
  selectedVibes: ProfilerVibe[];
  crowdStyle: ProfilerCrowdStyle;
  /** Derived from crowdStyle — hidden_gems includes niche/VIP */
  allowNiche: boolean;
  /** Compact tag e.g. foodie_relaxed */
  userProfileTag: UserProfileTag;
  completedAt: string;
  /** Legacy — ignored by matcher */
  transport?: ProfilerTransport;
  /** Legacy keyword list — ignored by matcher */
  tags?: string[];
}

export type QuizStepId = "vibe" | "pace" | "crowd";

export interface QuizOption<T extends string> {
  id: T;
  label: string;
  hint: string;
}

export const QUIZ_VIBE: QuizOption<ProfilerVibe>[] = [
  {
    id: "culture",
    label: "Culture & Heritage",
    hint: "Temples, tea ceremony, traditional crafts",
  },
  {
    id: "foodie",
    label: "Food & Nightlife",
    hint: "Markets, sake, izakaya, culinary crawls",
  },
  {
    id: "modern",
    label: "Modern & Pop Culture",
    hint: "Anime, digital art, shopping districts",
  },
  {
    id: "nature",
    label: "Nature & Scenery",
    hint: "Fuji views, gardens, hiking, bamboo",
  },
];

export const QUIZ_PACE: QuizOption<ProfilerPace>[] = [
  {
    id: "relaxed",
    label: "Take it easy, no stress",
    hint: "1 activity / day · low walking",
  },
  {
    id: "standard",
    label: "Balanced half-days",
    hint: "2 activities / day · 4–6 hours",
  },
  {
    id: "active",
    label: "Full schedule",
    hint: "Packed days · heavy walking",
  },
];

/** Short labels for the summary screen */
export const PACE_SUMMARY_LABEL: Record<ProfilerPace, string> = {
  relaxed: "Relaxed",
  standard: "Moderate",
  active: "Active",
};

export const QUIZ_CROWD: QuizOption<ProfilerCrowdStyle>[] = [
  {
    id: "hidden_gems",
    label: "Hidden Gems & Quiet Secrets",
    hint: "Off-path finds and rare VIP experiences",
  },
  {
    id: "classic",
    label: "Classic Landmarks",
    hint: "Iconic must-sees everyone loves",
  },
  {
    id: "balanced",
    label: "A Balanced Mix",
    hint: "Famous spots plus a few quieter finds",
  },
];

/** @deprecated Prefer QUIZ_CROWD */
export const QUIZ_NICHE: QuizOption<"skip" | "vip">[] = [
  {
    id: "skip",
    label: "Just the classics",
    hint: "Skip ultra-niche VIP experiences",
  },
  {
    id: "vip",
    label: "Show me rare VIP experiences",
    hint: "Sword forging, sumo access, helicopter, etc.",
  },
];

/** @deprecated Prefer QUIZ_CROWD */
export const QUIZ_TRANSPORT: QuizOption<ProfilerTransport>[] = [
  {
    id: "chauffeur",
    label: "Private Luxury Chauffeur",
    hint: "Door-to-door between activities",
  },
  {
    id: "local",
    label: "Local Express & Walking",
    hint: "Trains, metros, and on foot",
  },
];

const VIBE_TAG_PREFIX: Record<ProfilerVibe, string> = {
  culture: "cultural",
  foodie: "foodie",
  modern: "modern",
  nature: "nature",
};

export function crowdStyleAllowsNiche(style: ProfilerCrowdStyle): boolean {
  return style === "hidden_gems";
}

export function buildUserProfileTag(
  vibe: ProfilerVibe,
  pace: ProfilerPace
): UserProfileTag {
  return `${VIBE_TAG_PREFIX[vibe]}_${pace}`;
}

export function createExperienceProfile(
  vibe: ProfilerVibe,
  pace: ProfilerPace,
  crowdStyle: ProfilerCrowdStyle
): ExperienceProfile {
  return {
    vibe,
    pace,
    selectedVibes: [vibe],
    crowdStyle,
    allowNiche: crowdStyleAllowsNiche(crowdStyle),
    userProfileTag: buildUserProfileTag(vibe, pace),
    completedAt: new Date().toISOString(),
  };
}

export function profileToQuizAnswers(
  profile: ExperienceProfile | null | undefined
): QuizAnswers | null {
  if (!profile) return null;
  const vibes =
    profile.selectedVibes?.length > 0
      ? profile.selectedVibes
      : profile.vibe
        ? [profile.vibe]
        : [];
  if (vibes.length === 0) return null;
  const pace: ExperiencePaceTag =
    (profile.pace as string) === "balanced" ? "standard" : profile.pace;
  const crowd = profile.crowdStyle ?? "balanced";
  return {
    selectedVibes: vibes,
    preferredPace: pace,
    allowNiche: Boolean(profile.allowNiche),
    // Open explorers → multi-vibe guided tours; specific interests → single experiences
    matchMode: crowd === "balanced" ? "balanced" : "specific",
  };
}

/** Activities per stay-night target from pace answer. */
export function activitiesPerDay(pace: ProfilerPace): number {
  if (pace === "relaxed") return 1;
  if (pace === "active") return 3;
  return 2;
}

export function scoreTourForProfile(
  tour: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    duration_hours?: number;
    vibe_tags?: string[];
    pace_tag?: string;
    is_niche?: boolean;
    access_type?: string;
  },
  profile: ExperienceProfile | null | undefined
): number {
  return scoreTourAgainstQuiz(tour, profileToQuizAnswers(profile));
}

export function isBestMatchTour(
  tour: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    duration_hours?: number;
    vibe_tags?: string[];
    pace_tag?: string;
    is_niche?: boolean;
    access_type?: string;
  },
  profile: ExperienceProfile | null | undefined
): boolean {
  return matchesQuizAnswers(tour, profileToQuizAnswers(profile));
}

export function rankToursByProfile<
  T extends {
    id: string;
    title?: string;
    description?: string;
    category?: string;
    duration_hours?: number;
    vibe_tags?: string[];
    pace_tag?: string;
    is_niche?: boolean;
    access_type?: string;
  },
>(tours: T[], profile: ExperienceProfile | null | undefined): T[] {
  const answers = profileToQuizAnswers(profile);
  if (!answers) return tours;
  const matched = new Set(
    filterAndRankToursByQuiz(tours, answers).map((t) => t.id)
  );
  return [...tours].sort((a, b) => {
    const am = matched.has(a.id) ? 1 : 0;
    const bm = matched.has(b.id) ? 1 : 0;
    if (bm !== am) return bm - am;
    return scoreTourAgainstQuiz(b, answers) - scoreTourAgainstQuiz(a, answers);
  });
}

export function recommendedToursForCity<
  T extends {
    id: string;
    title?: string;
    description?: string;
    category?: string;
    duration_hours?: number;
    vibe_tags?: string[];
    pace_tag?: string;
    is_niche?: boolean;
    access_type?: string;
    is_active?: boolean;
    city_id?: string;
  },
>(
  tours: T[],
  cityId: string,
  nights: number,
  profile: ExperienceProfile | null | undefined
): T[] {
  if (!profile) return [];
  const cityTours = tours.filter(
    (t) => t.city_id === cityId && t.is_active !== false
  );
  const ranked = filterAndRankToursByQuiz(
    cityTours,
    profileToQuizAnswers(profile)
  );
  const limit = Math.max(
    1,
    activitiesPerDay(profile.pace) * Math.max(1, nights)
  );
  return ranked.slice(0, limit);
}

export function profileSummary(profile: ExperienceProfile): string {
  const pace = PACE_SUMMARY_LABEL[profile.pace] ?? profile.pace;
  const vibe =
    QUIZ_VIBE.find((o) => o.id === profile.vibe)?.label ?? profile.vibe;
  const crowd =
    QUIZ_CROWD.find((o) => o.id === profile.crowdStyle)?.label ??
    (profile.allowNiche ? "Hidden Gems & Quiet Secrets" : "Classic Landmarks");
  return `${vibe} · ${pace} · ${crowd}`;
}

/** Normalize persisted / legacy quiz profiles. */
export function coerceExperienceProfile(
  raw: unknown
): ExperienceProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const ep = raw as Partial<ExperienceProfile> & {
    pace?: string;
    vibe?: string;
    crowdStyle?: string;
  };
  const vibe = ep.vibe as ProfilerVibe | undefined;
  if (!vibe || !["culture", "foodie", "modern", "nature"].includes(vibe)) {
    return null;
  }
  const pace: ProfilerPace =
    String(ep.pace) === "balanced"
      ? "standard"
      : ep.pace === "relaxed" || ep.pace === "standard" || ep.pace === "active"
        ? ep.pace
        : "standard";
  const crowdStyle: ProfilerCrowdStyle =
    ep.crowdStyle === "hidden_gems" ||
    ep.crowdStyle === "classic" ||
    ep.crowdStyle === "balanced"
      ? ep.crowdStyle
      : typeof ep.allowNiche === "boolean"
        ? ep.allowNiche
          ? "hidden_gems"
          : "classic"
        : "balanced";
  const allowNiche =
    typeof ep.allowNiche === "boolean"
      ? ep.allowNiche
      : crowdStyleAllowsNiche(crowdStyle);
  return {
    vibe,
    pace,
    selectedVibes:
      Array.isArray(ep.selectedVibes) && ep.selectedVibes.length > 0
        ? (ep.selectedVibes as ProfilerVibe[])
        : [vibe],
    crowdStyle,
    allowNiche,
    userProfileTag:
      typeof ep.userProfileTag === "string" && ep.userProfileTag
        ? ep.userProfileTag
        : buildUserProfileTag(vibe, pace),
    completedAt:
      typeof ep.completedAt === "string"
        ? ep.completedAt
        : new Date().toISOString(),
  };
}

export function experienceToUserTravelProfile(profile: ExperienceProfile): {
  vibe: ProfilerVibe;
  pace: ProfilerPace;
  crowdStyle: ProfilerCrowdStyle;
  isCompleted: true;
} {
  return {
    vibe: profile.vibe,
    pace: profile.pace,
    crowdStyle: profile.crowdStyle,
    isCompleted: true,
  };
}
