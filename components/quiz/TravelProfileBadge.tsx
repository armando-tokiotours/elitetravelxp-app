"use client";

import { useEffect } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  createExperienceProfile,
  experienceToUserTravelProfile,
  PACE_SUMMARY_LABEL,
  QUIZ_CROWD,
  QUIZ_VIBE,
} from "@/lib/experienceProfiler";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";

/**
 * Inline active profile badge — Builder, Tailored Experiences, Discover.
 * Keeps builder ↔ itinerary profile stores aligned after localStorage hydrate.
 */
export function TravelProfileBadge({
  onRetake,
  tone = "dark",
}: {
  onRetake: () => void;
  tone?: "dark" | "light";
}) {
  const experienceProfile = useBuilderStore((s) => s.experienceProfile);
  const setExperienceProfile = useBuilderStore((s) => s.setExperienceProfile);
  const userProfile = useItineraryStore((s) => s.userProfile);
  const setUserProfile = useItineraryStore((s) => s.setUserProfile);

  useEffect(() => {
    if (experienceProfile && !userProfile?.isCompleted) {
      setUserProfile(experienceToUserTravelProfile(experienceProfile));
      return;
    }
    if (!experienceProfile && userProfile?.isCompleted) {
      setExperienceProfile(
        createExperienceProfile(
          userProfile.vibe,
          userProfile.pace,
          userProfile.crowdStyle
        )
      );
    }
  }, [
    experienceProfile,
    userProfile,
    setExperienceProfile,
    setUserProfile,
  ]);

  const vibe = experienceProfile?.vibe ?? userProfile?.vibe;
  const pace = experienceProfile?.pace ?? userProfile?.pace;
  const crowd = experienceProfile?.crowdStyle ?? userProfile?.crowdStyle;

  if (!vibe || !pace) return null;

  const vibeLabel = QUIZ_VIBE.find((o) => o.id === vibe)?.label ?? vibe;
  const paceLabel = PACE_SUMMARY_LABEL[pace] ?? pace;
  const crowdLabel = crowd
    ? QUIZ_CROWD.find((o) => o.id === crowd)?.label ?? ""
    : "";

  const dark = tone === "dark";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 ${
        dark
          ? "border-[#C4A35A]/35 bg-[#C4A35A]/10"
          : "border-[#C4A35A]/40 bg-[#F7EFD9]"
      }`}
    >
      <div className="min-w-0 flex items-start gap-2">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            dark ? "bg-[#C4A35A]/20 text-[#C4A35A]" : "bg-white text-[#8A6B2A]"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
              dark ? "text-[#C4A35A]" : "text-[#8A6B2A]"
            }`}
          >
            Your Travel Profile
          </p>
          <p
            className={`mt-0.5 truncate text-xs font-medium ${
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
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
          dark
            ? "border-white/20 text-[#E8D5A3] hover:border-[#C4A35A]/50"
            : "border-[#C4A35A]/40 text-[#6B5420] hover:bg-white"
        }`}
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Retake Quiz
      </button>
    </div>
  );
}
