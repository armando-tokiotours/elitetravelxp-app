"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import {
  PACE_SUMMARY_LABEL,
  QUIZ_CROWD,
  QUIZ_VIBE,
} from "@/lib/experienceProfiler";
import { useQuizStore } from "@/store/useQuizStore";

/**
 * Inline active Match Quiz badge — only when the user explicitly completed the quiz.
 * Never reconstructs a profile from Pre-Elite or leftover itinerary data.
 */
export function TravelProfileBadge({
  onRetake,
  tone = "dark",
}: {
  onRetake: () => void;
  tone?: "dark" | "light";
}) {
  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const travelProfile = useQuizStore((s) => s.travelProfile);

  if (!isQuizCompleted || !travelProfile) return null;

  const vibe = travelProfile.vibe;
  const pace = travelProfile.pace;
  const crowd = travelProfile.crowdStyle;

  const vibeLabel = QUIZ_VIBE.find((o) => o.id === vibe)?.label ?? vibe;
  const paceLabel = PACE_SUMMARY_LABEL[pace] ?? pace;
  const crowdLabel = crowd
    ? QUIZ_CROWD.find((o) => o.id === crowd)?.label ?? ""
    : "";

  const dark = tone === "dark";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:px-3.5 sm:py-2.5 ${
        dark
          ? "border-[#075473]/35 bg-[#075473]/10"
          : "border-[#075473]/40 bg-[#FAF0E6]"
      }`}
    >
      <div className="flex min-w-0 items-start gap-1.5 sm:gap-2">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-7 sm:w-7 ${
            dark ? "bg-[#F29727]/20 text-[#F29727]" : "bg-white text-[#7E3202]"
          }`}
        >
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className={`text-[9px] font-semibold uppercase tracking-[0.16em] sm:text-[10px] ${
              dark ? "text-[#F29727]" : "text-[#7E3202]"
            }`}
          >
            Your Travel Profile
          </p>
          <p
            className={`mt-0.5 line-clamp-2 break-words whitespace-normal text-[11px] font-medium leading-snug sm:text-xs ${
              dark ? "text-zinc-200" : "text-[#0B1F3A]"
            }`}
          >
            {vibeLabel} · {paceLabel}
            {crowdLabel ? ` · ${crowdLabel}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetake}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] ${
          dark
            ? "border-white/20 text-[#075473] hover:border-[#075473]/50"
            : "border-[#075473]/40 text-[#632502] hover:bg-white"
        }`}
      >
        <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
        Retake Quiz
      </button>
    </div>
  );
}
