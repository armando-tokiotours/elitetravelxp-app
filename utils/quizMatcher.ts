import {
  normalizeCategory,
  resolveTourTags,
  type Experience,
  type ExperienceAccessType,
  type ExperienceCategory,
  type ExperiencePaceTag,
  type ExperienceVibeTag,
} from "@/types/experience";

/** How the guest wants recommendations shaped. */
export type QuizMatchMode = "balanced" | "specific";

export interface QuizAnswers {
  /** Guest vibe picks (usually 1 from the quiz) */
  selectedVibes: ExperienceVibeTag[];
  preferredPace: ExperiencePaceTag;
  /** Include VIP / niche exclusives */
  allowNiche: boolean;
  /**
   * balanced → prioritize multi-vibe Guided Tours
   * specific → prioritize Single Experiences matching primary vibe
   */
  matchMode?: QuizMatchMode;
}

type MatchableTour = {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  duration_hours?: number;
  vibe_tags?: string[];
  pace_tag?: string;
  is_niche?: boolean;
  is_active?: boolean;
  city_id?: string;
  access_type?: string;
  crowd_tag?: string;
};

function primaryVibeHits(
  vibeTags: ExperienceVibeTag[],
  selected: ExperienceVibeTag[]
): number {
  const selectedPrimary = selected.filter((v) => v !== "multi_vibe");
  return vibeTags.filter(
    (tag) => tag !== "multi_vibe" && selectedPrimary.includes(tag)
  ).length;
}

/**
 * Lightweight tag matcher — filters activities against quiz answers.
 * Niche items only appear when allowNiche is true.
 * Pace: exact match OR activity is "standard" (flexible half-day).
 */
export function getRecommendedExperiences(
  allExperiences: Experience[],
  answers: QuizAnswers
): Experience[] {
  const vibes = answers.selectedVibes;
  if (vibes.length === 0) return [];

  return allExperiences
    .filter((item) => {
      if (item.isNiche && !answers.allowNiche) return false;
      const matchesVibe =
        item.vibeTags.includes("multi_vibe") ||
        item.vibeTags.some((tag) => vibes.includes(tag));
      const matchesPace =
        item.paceTag === answers.preferredPace || item.paceTag === "standard";
      return matchesVibe && matchesPace;
    })
    .sort(
      (a, b) =>
        scoreExperienceAgainstQuiz(b, answers) -
        scoreExperienceAgainstQuiz(a, answers)
    );
}

function scoreExperienceAgainstQuiz(
  item: Experience,
  answers: QuizAnswers
): number {
  return scoreTourAgainstQuiz(
    {
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      vibe_tags: item.vibeTags,
      pace_tag: item.paceTag,
      is_niche: item.isNiche,
      access_type: item.accessType,
      crowd_tag: item.crowdTag,
    },
    answers
  );
}

/** Same rules against PocketBase tour rows (with tag inference fallback). */
export function matchesQuizAnswers(
  tour: MatchableTour,
  answers: QuizAnswers | null | undefined
): boolean {
  if (!answers || answers.selectedVibes.length === 0) return false;
  const tags = resolveTourTags(tour);
  if (tags.isNiche && !answers.allowNiche) return false;
  if (tags.vibeTags.length === 0) return false;
  const matchesVibe =
    tags.vibeTags.includes("multi_vibe") ||
    tags.vibeTags.some((tag) => answers.selectedVibes.includes(tag));
  const matchesPace =
    tags.paceTag === answers.preferredPace || tags.paceTag === "standard";
  return matchesVibe && matchesPace;
}

/**
 * Rank:
 * - Balanced Mix → Guided Tours with multiple vibe hits / multi_vibe
 * - Specific Interests → Single Experiences matching primary vibe + access
 */
export function scoreTourAgainstQuiz(
  tour: MatchableTour,
  answers: QuizAnswers | null | undefined
): number {
  if (!answers) return 0;
  const tags = resolveTourTags(tour);
  if (tags.isNiche && !answers.allowNiche) return 0;
  let score = 0;

  const hits = primaryVibeHits(tags.vibeTags, answers.selectedVibes);
  score += hits * 4;
  if (tags.vibeTags.includes("multi_vibe")) score += 2;

  if (tags.paceTag === answers.preferredPace) score += 3;
  else if (tags.paceTag === "standard") score += 1;

  const mode: QuizMatchMode = answers.matchMode ?? "specific";
  const category: ExperienceCategory = tags.category;
  const access: ExperienceAccessType = tags.accessType;

  if (mode === "balanced") {
    if (category === "tour") score += 6;
    if (hits >= 2 || tags.vibeTags.includes("multi_vibe")) score += 4;
    if (access === "guided_route") score += 2;
    if (tags.crowdTag === "balanced_mix") score += 3;
  } else {
    if (category === "activity") score += 6;
    if (hits === 1 && tags.vibeTags.filter((v) => v !== "multi_vibe").length <= 1)
      score += 3;
    if (access === "direct_ticket" || access === "time_sensitive") score += 2;
    if (
      answers.allowNiche &&
      (access === "vip_event" || tags.isNiche || tags.crowdTag === "hidden_gem")
    ) {
      score += 3;
    }
    if (!answers.allowNiche && tags.crowdTag === "classic_highlight") {
      score += 2;
    }
  }

  if (tags.isNiche && answers.allowNiche) score += 1;
  return score;
}

export function filterAndRankToursByQuiz<T extends MatchableTour & { id: string }>(
  tours: T[],
  answers: QuizAnswers | null | undefined
): T[] {
  if (!answers) return tours;
  return [...tours]
    .filter((t) => matchesQuizAnswers(t, answers))
    .sort(
      (a, b) =>
        scoreTourAgainstQuiz(b, answers) - scoreTourAgainstQuiz(a, answers)
    );
}

export function isGuidedTour(tour: { category?: string }): boolean {
  return normalizeCategory(tour.category) === "tour";
}

export function isSingleExperience(tour: { category?: string }): boolean {
  return normalizeCategory(tour.category) === "activity";
}
