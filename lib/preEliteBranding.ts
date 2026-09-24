/**
 * Pre-Builder Match Quiz branding — PocketBase `branding_ui_items`
 * key prefix `pre_elite_{optionId}`, category `pre_elite`.
 *
 * Field map:
 *   title / subtitle → option + story header
 *   media → story slide 1 background (image or video)
 *   poster → story slide 2 background
 *   cta_primary / inclusion_body → slide 1 title / caption (optional)
 *   cta_secondary / credit_body → slide 2 title / caption (optional)
 */

import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
} from "@/lib/preEliteBuilder";
import {
  getStoryExplanation,
  type StoryExplanation,
  type StorySlide,
} from "@/lib/preEliteStories";
import { isVideoFilename, plainBrandingText } from "@/lib/brandingUi";

export const PRE_ELITE_BRANDING_CATEGORY = "pre_elite" as const;
export const PRE_ELITE_BRANDING_PREFIX = "pre_elite_";
export const PRE_ELITE_QUIZ_LS_KEY = "tokio_pre_elite_quiz_branding";

/** Minimal branding shape (store ResolvedBrandingUiItem or PB-derived). */
export type PreEliteBrandingOverlay = {
  title?: string;
  subtitle?: string;
  mediaUrl?: string;
  posterUrl?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  inclusionBody?: string;
  creditBody?: string;
};

export type PreEliteQuizSectionId =
  | "travel_style"
  | "interests"
  | "motivation"
  | "what_to_avoid";

export const PRE_ELITE_QUIZ_SECTIONS: Array<{
  id: PreEliteQuizSectionId;
  label: string;
  options: readonly { id: string; title: string; description: string }[];
}> = [
  {
    id: "travel_style",
    label: "Travel Style",
    options: TRAVEL_STYLES,
  },
  {
    id: "interests",
    label: "Interests",
    options: INTERESTS,
  },
  {
    id: "motivation",
    label: "Motivation",
    options: MOTIVATIONS,
  },
  {
    id: "what_to_avoid",
    label: "What to Avoid",
    options: PAIN_POINTS,
  },
];

export function preEliteBrandingKey(optionId: string): string {
  return `${PRE_ELITE_BRANDING_PREFIX}${optionId}`;
}

export function isPreEliteBrandingKey(key: string): boolean {
  return key.startsWith(PRE_ELITE_BRANDING_PREFIX);
}

export type PreEliteQuizLocalEntry = {
  title: string;
  subtitle: string;
  mediaUrl?: string;
  posterUrl?: string;
  slide1Title?: string;
  slide1Caption?: string;
  slide2Title?: string;
  slide2Caption?: string;
  updatedAt: number;
};

export type PreEliteQuizLocalCache = Record<string, PreEliteQuizLocalEntry>;

export function readPreEliteQuizLocalCache(): PreEliteQuizLocalCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRE_ELITE_QUIZ_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PreEliteQuizLocalCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePreEliteQuizLocalEntry(
  optionId: string,
  entry: Omit<PreEliteQuizLocalEntry, "updatedAt"> & { updatedAt?: number }
): void {
  if (typeof window === "undefined") return;
  try {
    const next = {
      ...readPreEliteQuizLocalCache(),
      [optionId]: {
        ...entry,
        updatedAt: entry.updatedAt ?? Date.now(),
      },
    };
    localStorage.setItem(PRE_ELITE_QUIZ_LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function applySlideMedia(
  slide: StorySlide,
  url: string | undefined
): StorySlide {
  const media = (url || "").trim();
  if (!media) return slide;
  if (isVideoFilename(media)) {
    return { ...slide, videoUrl: media, imageUrl: slide.imageUrl };
  }
  return { ...slide, imageUrl: media, videoUrl: undefined };
}

/**
 * Merge static story defaults with PocketBase / local branding overrides.
 */
export function resolvePreEliteStory(
  optionId: string,
  branding?: PreEliteBrandingOverlay | null,
  local?: PreEliteQuizLocalEntry | null
): StoryExplanation | null {
  const base = getStoryExplanation(optionId);
  if (!base) return null;

  const title =
    local?.title?.trim() ||
    branding?.title?.trim() ||
    base.title;
  const subtitle =
    local?.subtitle?.trim() ||
    branding?.subtitle?.trim() ||
    base.subtitle;

  const slide1Url = local?.mediaUrl || branding?.mediaUrl || "";
  const slide2Url = local?.posterUrl || branding?.posterUrl || "";

  const slides = base.slides.map((slide, i) => {
    let next = slide;
    if (i === 0) {
      next = applySlideMedia(next, slide1Url);
      const t = local?.slide1Title?.trim() || branding?.ctaPrimary?.trim();
      const c =
        local?.slide1Caption?.trim() ||
        plainBrandingText(branding?.inclusionBody) ||
        "";
      if (t) next = { ...next, title: t };
      if (c) next = { ...next, caption: c };
    } else if (i === 1) {
      next = applySlideMedia(next, slide2Url);
      const t = local?.slide2Title?.trim() || branding?.ctaSecondary?.trim();
      const c =
        local?.slide2Caption?.trim() ||
        plainBrandingText(branding?.creditBody) ||
        "";
      if (t) next = { ...next, title: t };
      if (c) next = { ...next, caption: c };
    }
    return next;
  });

  return {
    ...base,
    title,
    subtitle,
    slides,
  };
}

/** All Pre-Elite option IDs that support story branding. */
export function allPreEliteOptionIds(): string[] {
  return PRE_ELITE_QUIZ_SECTIONS.flatMap((s) => s.options.map((o) => o.id));
}
