/**
 * Pre-Builder Match Quiz branding — PocketBase `branding_ui_items`
 * key prefix `pre_elite_{optionId}`, category `pre_elite`.
 *
 * Field map:
 *   title / subtitle → option + story header
 *   card → selected choice-card background (image or video)
 *   media → story slide 1 background (image or video)
 *   media_poster → fast preload still for slide 1 video
 *   poster → story slide 2 background
 *   slide2_poster → fast preload still for slide 2 video
 *   slide3 → story slide 3 background
 *   slide3_poster → fast preload still for slide 3 video
 *   card / card_poster → choice-card background + video still
 *   cta_primary / inclusion_body → slide 1 title / caption (optional)
 *   cta_secondary / credit_body → slide 2 title / caption (optional)
 *   inclusion_title / credit_title → slide 3 title / caption (optional)
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

/**
 * Guest UI media must live under `public/` (path starts with `/brand`, `/images`, `/svg`, …).
 * PocketBase `/api/files/…` blobs are data-store uploads — ignored for guest rendering.
 */
export function isPublicMediaPath(url: string): boolean {
  const u = (url || "").trim();
  if (!u.startsWith("/")) return false;
  if (u.startsWith("/api/")) return false;
  return true;
}

function publicOnly(url: string | undefined): string {
  const u = (url || "").trim();
  return isPublicMediaPath(u) ? u : "";
}
export const PRE_ELITE_BRANDING_PREFIX = "pre_elite_";
export const PRE_ELITE_QUIZ_LOCAL_KEY = "tokio_pre_elite_quiz_branding";

/** Minimal branding shape (store ResolvedBrandingUiItem or PB-derived). */
export type PreEliteBrandingOverlay = {
  title?: string;
  subtitle?: string;
  mediaUrl?: string;
  posterUrl?: string;
  slide3Url?: string;
  /** Selected choice-card background */
  cardUrl?: string;
  /** Still for card video */
  cardPosterUrl?: string;
  /** Fast preload stills for story videos */
  mediaPosterUrl?: string;
  slide2PosterUrl?: string;
  slide3PosterUrl?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  inclusionBody?: string;
  creditBody?: string;
  inclusionTitle?: string;
  creditTitle?: string;
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
  slide3Url?: string;
  cardUrl?: string;
  cardPosterUrl?: string;
  mediaPosterUrl?: string;
  slide2PosterUrl?: string;
  slide3PosterUrl?: string;
  slide1Title?: string;
  slide1Caption?: string;
  slide2Title?: string;
  slide2Caption?: string;
  slide3Title?: string;
  slide3Caption?: string;
  updatedAt: number;
};

export type PreEliteQuizLocalCache = Record<string, PreEliteQuizLocalEntry>;

export function readPreEliteQuizLocalCache(): PreEliteQuizLocalCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRE_ELITE_QUIZ_LOCAL_KEY);
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
    localStorage.setItem(PRE_ELITE_QUIZ_LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function applySlideMedia(
  slide: StorySlide,
  url: string | undefined,
  stillUrl?: string
): StorySlide {
  const media = publicOnly(url);
  const still = publicOnly(stillUrl);
  // No PB files, no videos — guest stories are public stills only.
  // Missing media → empty imageUrl (UI paints plain grey card, never logo).
  if (!media) {
    return {
      ...slide,
      videoUrl: undefined,
      imageUrl: still || slide.imageUrl || "",
    };
  }
  if (isVideoFilename(media)) {
    return {
      ...slide,
      videoUrl: undefined,
      imageUrl: still || slide.imageUrl || "",
    };
  }
  return { ...slide, imageUrl: media, videoUrl: undefined };
}

function ensureThreeSlides(
  optionId: string,
  slides: StorySlide[]
): StorySlide[] {
  const next = slides.slice(0, 3);
  while (next.length < 3) {
    const n = next.length + 1;
    next.push({
      id: `${optionId}-slide-${n}`,
      title: `Moment ${n}`,
      caption: "A closer look at how this choice shapes your Japan days.",
      imageUrl: next[0]?.imageUrl || "",
    });
  }
  return next;
}

/**
 * Merge static story defaults with PocketBase / local branding overrides.
 * Always resolves to 3 slides (image or video each).
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
  const slide3Url = local?.slide3Url || branding?.slide3Url || "";
  const slide1Still =
    local?.mediaPosterUrl || branding?.mediaPosterUrl || "";
  const slide2Still =
    local?.slide2PosterUrl || branding?.slide2PosterUrl || "";
  const slide3Still =
    local?.slide3PosterUrl || branding?.slide3PosterUrl || "";

  const slides = ensureThreeSlides(optionId, base.slides).map((slide, i) => {
    let next = slide;
    if (i === 0) {
      next = applySlideMedia(next, slide1Url, slide1Still);
      const t = local?.slide1Title?.trim() || branding?.ctaPrimary?.trim();
      const c =
        local?.slide1Caption?.trim() ||
        plainBrandingText(branding?.inclusionBody) ||
        "";
      if (t) next = { ...next, title: t };
      if (c) next = { ...next, caption: c };
    } else if (i === 1) {
      next = applySlideMedia(next, slide2Url, slide2Still);
      const t = local?.slide2Title?.trim() || branding?.ctaSecondary?.trim();
      const c =
        local?.slide2Caption?.trim() ||
        plainBrandingText(branding?.creditBody) ||
        "";
      if (t) next = { ...next, title: t };
      if (c) next = { ...next, caption: c };
    } else if (i === 2) {
      next = applySlideMedia(next, slide3Url, slide3Still);
      const t = local?.slide3Title?.trim() || branding?.inclusionTitle?.trim();
      const c =
        local?.slide3Caption?.trim() || branding?.creditTitle?.trim() || "";
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

/**
 * Selected choice-card background.
 * Priority: Team Access card → hardcoded SVG → story slide 1 → fallback SVG.
 */
export function resolvePreEliteCardMedia(
  optionId: string,
  branding?: PreEliteBrandingOverlay | null,
  local?: PreEliteQuizLocalEntry | null,
  svgFallback?: string
): { url: string; isVideo: boolean; posterUrl?: string } {
  const card = publicOnly(local?.cardUrl || branding?.cardUrl);
  if (card && !isVideoFilename(card)) {
    return { url: card, isVideo: false };
  }
  const svg = publicOnly(svgFallback);
  if (svg) {
    return { url: svg, isVideo: false };
  }
  const slide1 = publicOnly(local?.mediaUrl || branding?.mediaUrl);
  if (slide1 && !isVideoFilename(slide1)) {
    return { url: slide1, isVideo: false };
  }
  const story = getStoryExplanation(optionId);
  const fromStory = publicOnly(story?.slides[0]?.imageUrl);
  if (fromStory && !isVideoFilename(fromStory)) {
    return { url: fromStory, isVideo: false };
  }
  return { url: "/svg/style-premium-comfort.svg", isVideo: false };
}
