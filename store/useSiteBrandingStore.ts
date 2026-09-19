"use client";

import { create } from "zustand";
import {
  brandingUiMediaUrl,
  brandingUiPosterUrl,
  fetchBrandingUiItems,
  type PbBrandingUiItem,
} from "@/lib/pocketbase/client";
import type { PaceId } from "@/lib/travelPace";
import type {
  ProfilerCrowdStyle,
  ProfilerPace,
  ProfilerVibe,
  QuizOption,
} from "@/lib/experienceProfiler";
import {
  BRANDING_UI_FALLBACKS,
  CONCIERGE_POSTER_FALLBACK,
  PACE_IDS,
  QUIZ_CROWD_IDS,
  QUIZ_PACE_IDS,
  QUIZ_VIBE_IDS,
  isVideoFilename,
  paceBrandingKey,
  plainBrandingText,
  quizCrowdBrandingKey,
  quizPaceBrandingKey,
  quizVibeBrandingKey,
} from "@/lib/brandingUi";

export interface ResolvedBrandingUiItem {
  key: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
  inclusionTitle: string;
  inclusionBody: string;
  creditTitle: string;
  creditBody: string;
  /** Absolute or site-relative URL for card / modal media */
  mediaUrl: string;
  isVideo: boolean;
  /** Poster for video items */
  posterUrl: string;
  recordId: string | null;
}

function resolveItem(
  key: string,
  row: PbBrandingUiItem | undefined
): ResolvedBrandingUiItem {
  const fallback = BRANDING_UI_FALLBACKS[key];
  const title = (row?.title || "").trim() || fallback?.title || key;
  const subtitle = (row?.subtitle || "").trim() || fallback?.subtitle || "";
  const description =
    plainBrandingText(row?.description) || fallback?.description || "";
  const ctaPrimary =
    (row?.cta_primary || "").trim() || fallback?.ctaPrimary || "";
  const ctaSecondary =
    (row?.cta_secondary || "").trim() || fallback?.ctaSecondary || "";
  const inclusionTitle =
    (row?.inclusion_title || "").trim() || fallback?.inclusionTitle || "";
  const inclusionBody =
    plainBrandingText(row?.inclusion_body) || fallback?.inclusionBody || "";
  const creditTitle =
    (row?.credit_title || "").trim() || fallback?.creditTitle || "";
  const creditBody =
    plainBrandingText(row?.credit_body) || fallback?.creditBody || "";
  const pbMedia = brandingUiMediaUrl(row);
  const mediaUrl = pbMedia || fallback?.mediaFallback || "";
  const isVideo = mediaUrl ? isVideoFilename(mediaUrl) : false;
  const pbPoster = brandingUiPosterUrl(row);
  const posterUrl =
    pbPoster ||
    (key === "elite_concierge_modal" || key === "concierge_preview"
      ? CONCIERGE_POSTER_FALLBACK
      : isVideo
        ? ""
        : mediaUrl);

  return {
    key,
    category: row?.category || fallback?.category || "",
    title,
    subtitle,
    description,
    ctaPrimary,
    ctaSecondary,
    inclusionTitle,
    inclusionBody,
    creditTitle,
    creditBody,
    mediaUrl,
    isVideo,
    posterUrl,
    recordId: row?.id ?? null,
  };
}

interface SiteBrandingState {
  itemsByKey: Record<string, PbBrandingUiItem>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  getItem: (key: string) => ResolvedBrandingUiItem;
  getTravelPaces: () => Array<
    ResolvedBrandingUiItem & { id: PaceId; label: string; tagline: string; image: string }
  >;
  getQuizVibe: () => QuizOption<ProfilerVibe>[];
  getQuizPace: () => QuizOption<ProfilerPace>[];
  getQuizCrowd: () => QuizOption<ProfilerCrowdStyle>[];
  getConciergePreview: () => ResolvedBrandingUiItem;
  getEliteConciergeModal: () => ResolvedBrandingUiItem;
  getActivityMatcherBanner: () => ResolvedBrandingUiItem;
  getBudgetPlanner: () => ResolvedBrandingUiItem;
}

export const useSiteBrandingStore = create<SiteBrandingState>((set, get) => ({
  itemsByKey: {},
  loaded: false,
  loading: false,
  error: null,

  ensureLoaded: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const rows = await fetchBrandingUiItems();
      const itemsByKey: Record<string, PbBrandingUiItem> = {};
      for (const row of rows) {
        if (row.key) itemsByKey[row.key] = row;
      }
      set({ itemsByKey, loaded: true, loading: false });
    } catch (e) {
      set({
        loaded: true,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load branding UI",
      });
    }
  },

  getItem: (key) => resolveItem(key, get().itemsByKey[key]),

  getTravelPaces: () =>
    PACE_IDS.map((id) => {
      const key = paceBrandingKey(id);
      const item = resolveItem(key, get().itemsByKey[key]);
      return {
        ...item,
        id: id as PaceId,
        label: item.title,
        tagline: item.subtitle,
        image: item.mediaUrl,
      };
    }),

  getQuizVibe: () =>
    QUIZ_VIBE_IDS.map((id) => {
      const key = quizVibeBrandingKey(id);
      const item = resolveItem(key, get().itemsByKey[key]);
      return { id: id as ProfilerVibe, label: item.title, hint: item.subtitle };
    }),

  getQuizPace: () =>
    QUIZ_PACE_IDS.map((id) => {
      const key = quizPaceBrandingKey(id);
      const item = resolveItem(key, get().itemsByKey[key]);
      return { id: id as ProfilerPace, label: item.title, hint: item.subtitle };
    }),

  getQuizCrowd: () =>
    QUIZ_CROWD_IDS.map((id) => {
      const key = quizCrowdBrandingKey(id);
      const item = resolveItem(key, get().itemsByKey[key]);
      return {
        id: id as ProfilerCrowdStyle,
        label: item.title,
        hint: item.subtitle,
      };
    }),

  getConciergePreview: () =>
    resolveItem(
      "elite_concierge_modal",
      get().itemsByKey.elite_concierge_modal ??
        get().itemsByKey.concierge_preview
    ),

  getEliteConciergeModal: () =>
    resolveItem(
      "elite_concierge_modal",
      get().itemsByKey.elite_concierge_modal ??
        get().itemsByKey.concierge_preview
    ),

  getActivityMatcherBanner: () =>
    resolveItem(
      "activity_matcher_banner",
      get().itemsByKey.activity_matcher_banner
    ),

  getBudgetPlanner: () =>
    resolveItem("budget_planner", get().itemsByKey.budget_planner),
}));
