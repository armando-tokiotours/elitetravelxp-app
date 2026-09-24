/**
 * Match Quiz / Experience Profiler — dedicated zero-state store.
 * Completely independent from Pre-Elite brief answers.
 * Persist key: `quiz_storage`
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExperienceProfile,
  ProfilerCrowdStyle,
  ProfilerPace,
  ProfilerVibe,
} from "@/lib/experienceProfiler";

export type QuizTravelProfile = ExperienceProfile | null;

export interface QuizState {
  vibe: ProfilerVibe | null;
  pace: ProfilerPace | null;
  /** Access style (crowd) */
  accessStyle: ProfilerCrowdStyle | null;
  travelProfile: QuizTravelProfile;
  isQuizCompleted: boolean;
  completedAt: string | null;
}

export interface QuizActions {
  setDraftAnswers: ( partial: {
    vibe?: ProfilerVibe | null;
    pace?: ProfilerPace | null;
    accessStyle?: ProfilerCrowdStyle | null;
  }) => void;
  /** Persist a completed Match Quiz profile (Apply). */
  completeQuiz: (profile: ExperienceProfile) => void;
  /** Wipe to zero-state without touching other booking stores. */
  clearQuiz: () => void;
  reset: () => void;
}

export const QUIZ_ZERO_STATE: QuizState = {
  vibe: null,
  pace: null,
  accessStyle: null,
  travelProfile: null,
  isQuizCompleted: false,
  completedAt: null,
};

export const QUIZ_STORAGE_KEY = "quiz_storage";

export const useQuizStore = create<QuizState & QuizActions>()(
  persist(
    (set) => ({
      ...QUIZ_ZERO_STATE,

      setDraftAnswers: (partial) =>
        set((s) => ({
          vibe: partial.vibe !== undefined ? partial.vibe : s.vibe,
          pace: partial.pace !== undefined ? partial.pace : s.pace,
          accessStyle:
            partial.accessStyle !== undefined
              ? partial.accessStyle
              : s.accessStyle,
        })),

      completeQuiz: (profile) =>
        set({
          vibe: profile.vibe,
          pace: profile.pace,
          accessStyle: profile.crowdStyle,
          travelProfile: profile,
          isQuizCompleted: true,
          completedAt: profile.completedAt || new Date().toISOString(),
        }),

      clearQuiz: () => set({ ...QUIZ_ZERO_STATE }),

      reset: () => set({ ...QUIZ_ZERO_STATE }),
    }),
    {
      name: QUIZ_STORAGE_KEY,
      version: 1,
      partialize: (s) => ({
        vibe: s.vibe,
        pace: s.pace,
        accessStyle: s.accessStyle,
        travelProfile: s.travelProfile,
        isQuizCompleted: s.isQuizCompleted,
        completedAt: s.completedAt,
      }),
      migrate: (persisted) => {
        const p = (persisted || {}) as Partial<QuizState>;
        // Never revive incomplete quizzes with partial leftovers
        if (!p.isQuizCompleted || !p.travelProfile) {
          return { ...QUIZ_ZERO_STATE };
        }
        return {
          ...QUIZ_ZERO_STATE,
          vibe: p.vibe ?? p.travelProfile.vibe ?? null,
          pace: p.pace ?? p.travelProfile.pace ?? null,
          accessStyle:
            p.accessStyle ?? p.travelProfile.crowdStyle ?? null,
          travelProfile: p.travelProfile,
          isQuizCompleted: true,
          completedAt: p.completedAt ?? p.travelProfile.completedAt ?? null,
        };
      },
    }
  )
);

/** Active Match Quiz profile — null until the user explicitly completes the quiz. */
export function getCompletedQuizProfile(): ExperienceProfile | null {
  const s = useQuizStore.getState();
  if (!s.isQuizCompleted || !s.travelProfile) return null;
  return s.travelProfile;
}

/**
 * Hook: Match Quiz profile only when completed.
 * Use this for ★ Match badges / ranking — never Pre-Elite-derived profiles.
 */
export function useActiveMatchProfile(): ExperienceProfile | null {
  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const travelProfile = useQuizStore((s) => s.travelProfile);
  if (!isQuizCompleted || !travelProfile) return null;
  return travelProfile;
}
